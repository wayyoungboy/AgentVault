# AgentVault

Persistent local memory for AI coding agents.

AgentVault is a tiny MCP server that lets Cursor, Claude Desktop, Cline, RooCode, and other AI agents remember project facts, user preferences, decisions, deployment notes, and reusable coding context.

## Why

AI coding agents are powerful, but they forget too much between sessions:

- project architecture decisions
- coding style preferences
- repeated bug fixes
- deployment gotchas
- TODOs and product context

AgentVault gives them a simple local memory layer.

## Features

- `remember_fact` — save durable memory
- `search_memory` — retrieve relevant memory
- `list_recent_memories` — inspect recent memory
- `forget_memory` — delete stale or wrong memory
- `summarize_project_context` — generate compact project context

## Install

```bash
npm install
npm run build
```

## Run

```bash
npm run dev
```

## Claude Desktop example

```json
{
  "mcpServers": {
    "agent-vault": {
      "command": "node",
      "args": ["/absolute/path/to/AgentVault/dist/index.js"],
      "env": {
        "MEMORY_FILE": "/absolute/path/to/.agentvault.json"
      }
    }
  }
}
```

## Example memories

```text
The project uses TypeScript and NodeNext modules.
The user prefers concise PR descriptions.
The production deployment runs on Docker Compose.
Use pnpm only when packageManager is set.
```

## Design goals

- local-first
- readable JSON storage
- no database required for v0.1
- easy to fork
- easy to extend into hosted memory infrastructure

## Roadmap

- SQLite backend
- vector search
- project namespaces
- memory confidence
- duplicate detection
- GitHub issue and PR context
- hosted backend compatibility

## License

MIT
