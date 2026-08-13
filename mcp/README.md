# MCP Server

Model Context Protocol server for bedrock. Exposes evaluation-sheets and performance-goals as MCP tools so AI agents can interact with the API without going through the CLI.

## Tools

### Performance Goals (8 tools)

| Tool                         | Description                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `performance_goals_list`     | List goals with filters (period, scope, employee, department) |
| `performance_goals_mine`     | List own goals                                                |
| `performance_goals_show`     | Get a single goal by ID                                       |
| `performance_goals_tree`     | Goal hierarchy for a period                                   |
| `performance_goals_create`   | Create a goal                                                 |
| `performance_goals_update`   | Update a goal                                                 |
| `performance_goals_delete`   | Delete a goal                                                 |
| `performance_goals_evaluate` | Submit an evaluation (self/primary/secondary)                 |

### Evaluation Sheets (6 tools)

| Tool                           | Description                               |
| ------------------------------ | ----------------------------------------- |
| `evaluation_sheets_list`       | List sheets (admin)                       |
| `evaluation_sheets_mine`       | List own sheets                           |
| `evaluation_sheets_show`       | Get a single sheet                        |
| `evaluation_sheets_create`     | Create a sheet (admin)                    |
| `evaluation_sheets_transition` | Transition status with optimistic locking |
| `evaluation_sheets_evaluators` | Update evaluators (admin)                 |

## Configuration

The server reads authentication from `~/.config/bedrock/settings.json` (same as the CLI). Run `bedrock login` first to store credentials.

| Env                  | Default                  | Description      |
| -------------------- | ------------------------ | ---------------- |
| `BEDROCK_API`        | `http://127.0.0.1:18787` | API base URL     |
| `BEDROCK_CONFIG_DIR` | `~/.config/bedrock`      | Config directory |

## Prerequisites

1. Install the bedrock CLI (from the repo root):

   ```bash
   cd cli && bun link
   ```

2. Authenticate with the API:

   ```bash
   bedrock login --base-url http://127.0.0.1:18787
   ```

3. Verify credentials work:

   ```bash
   bedrock employees me
   ```

## Usage

### Claude Code (`.mcp.json`)

```json
{
  "mcpServers": {
    "bedrock": {
      "command": "bun",
      "args": ["mcp/index.ts"]
    }
  }
}
```

### Direct

```bash
bun mcp/index.ts
```

The server uses stdio transport. Send JSON-RPC messages on stdin, receive responses on stdout.
