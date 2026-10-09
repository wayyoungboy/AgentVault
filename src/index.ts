#!/usr/bin/env node
/**
 * AgentVault — local-first long-term memory MCP server (v0.1).
 * Stores memories as readable JSON; no database required.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

type Memory = {
  id: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type Store = {
  version: 1;
  memories: Memory[];
};

const DEFAULT_PATH = resolve(homedir(), ".agentvault.json");

function memoryFilePath(): string {
  const fromEnv = process.env.MEMORY_FILE?.trim();
  return fromEnv ? resolve(fromEnv) : DEFAULT_PATH;
}

async function loadStore(path: string): Promise<Store> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    if (!parsed || !Array.isArray(parsed.memories)) {
      return { version: 1, memories: [] };
    }
    return { version: 1, memories: parsed.memories };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return { version: 1, memories: [] };
    throw err;
  }
}

async function saveStore(path: string, store: Store): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(store, null, 2) + "\n", "utf8");
}

function scoreMemory(memory: Memory, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const hay = `${memory.content} ${memory.tags.join(" ")}`.toLowerCase();
  if (hay.includes(q)) return 100;
  const terms = q.split(/\s+/).filter(Boolean);
  let hits = 0;
  for (const t of terms) {
    if (hay.includes(t)) hits += 1;
  }
  return hits;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

const server = new McpServer({
  name: "agent-vault",
  version: "0.1.0",
});

server.tool(
  "remember_fact",
  "Save a durable memory (project fact, preference, decision, or note).",
  {
    content: z.string().min(1).describe("The fact or note to remember"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Optional tags for later filtering"),
  },
  async ({ content, tags }) => {
    const path = memoryFilePath();
    const store = await loadStore(path);
    const now = new Date().toISOString();
    const memory: Memory = {
      id: randomUUID(),
      content: content.trim(),
      tags: (tags ?? []).map((t) => t.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
    };
    store.memories.push(memory);
    await saveStore(path, store);
    return textResult(`Remembered ${memory.id}\n${JSON.stringify(memory, null, 2)}`);
  }
);

server.tool(
  "search_memory",
  "Retrieve memories relevant to a query (simple keyword match).",
  {
    query: z.string().min(1).describe("Search query"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max results (default 10)"),
  },
  async ({ query, limit }) => {
    const path = memoryFilePath();
    const store = await loadStore(path);
    const max = limit ?? 10;
    const ranked = store.memories
      .map((m) => ({ m, score: scoreMemory(m, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.m.updatedAt.localeCompare(a.m.updatedAt))
      .slice(0, max)
      .map((x) => x.m);
    if (ranked.length === 0) {
      return textResult(`No memories matched query: ${query}`);
    }
    return textResult(JSON.stringify(ranked, null, 2));
  }
);

server.tool(
  "list_recent_memories",
  "List the most recently updated memories.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max results (default 20)"),
  },
  async ({ limit }) => {
    const path = memoryFilePath();
    const store = await loadStore(path);
    const max = limit ?? 20;
    const recent = [...store.memories]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, max);
    return textResult(
      recent.length
        ? JSON.stringify(recent, null, 2)
        : "No memories stored yet."
    );
  }
);

server.tool(
  "forget_memory",
  "Delete a memory by id.",
  {
    id: z.string().min(1).describe("Memory id to delete"),
  },
  async ({ id }) => {
    const path = memoryFilePath();
    const store = await loadStore(path);
    const before = store.memories.length;
    store.memories = store.memories.filter((m) => m.id !== id);
    if (store.memories.length === before) {
      return textResult(`No memory found with id: ${id}`);
    }
    await saveStore(path, store);
    return textResult(`Forgot memory ${id}`);
  }
);

server.tool(
  "summarize_project_context",
  "Generate a compact project context summary from stored memories.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("How many recent memories to include (default 30)"),
  },
  async ({ limit }) => {
    const path = memoryFilePath();
    const store = await loadStore(path);
    const max = limit ?? 30;
    const recent = [...store.memories]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, max);
    if (recent.length === 0) {
      return textResult("No project context yet. Use remember_fact to store memories.");
    }
    const lines = [
      `# AgentVault project context (${recent.length} memories)`,
      `Storage: ${path}`,
      "",
      ...recent.map((m, i) => {
        const tag = m.tags.length ? ` [${m.tags.join(", ")}]` : "";
        return `${i + 1}. ${m.content}${tag}`;
      }),
    ];
    return textResult(lines.join("\n"));
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
