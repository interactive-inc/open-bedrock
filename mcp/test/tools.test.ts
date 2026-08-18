import { describe, expect, test } from "bun:test"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

/**
 * MCP サーバーのツール登録テスト。
 * 全ツールが正しく登録されていること、名前の重複がないことを検証する。
 * API 呼び出しはスタブしない（登録の正しさのみ検証）。
 */

const EXPECTED_TOOLS = [
  "performance_goals_list",
  "performance_goals_mine",
  "performance_goals_show",
  "performance_goals_tree",
  "performance_goals_create",
  "performance_goals_update",
  "performance_goals_delete",
  "performance_goals_evaluate",
  "evaluation_sheets_list",
  "evaluation_sheets_mine",
  "evaluation_sheets_show",
  "evaluation_sheets_create",
  "evaluation_sheets_transition",
  "evaluation_sheets_evaluators",
  "life_events_request",
  "life_events_mine",
  "application_templates_list",
  "application_requests_submit",
  "application_requests_mine",
  "application_requests_inbox",
  "application_requests_show",
  "application_requests_approve",
  "application_requests_reject",
] as const

describe("MCP tool registration", () => {
  test("all expected tools are registered", async () => {
    // index.ts を import するとサーバーが起動してしまうため、
    // 別プロセスで tools/list を呼んで検証する。
    const proc = Bun.spawn(["bun", "run", "index.ts"], {
      cwd: import.meta.dir.replace("/test", ""),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "ignore",
    })

    const initRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0.1.0" },
      },
    })

    const listRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    })

    proc.stdin.write(`${initRequest}\n${listRequest}\n`)
    proc.stdin.end()

    const output = await new Response(proc.stdout).text()
    const lines = output.trim().split("\n")

    // 2行目が tools/list の応答
    const toolsResponse = JSON.parse(lines[1])
    const toolNames: string[] = toolsResponse.result.tools.map((t: { name: string }) => t.name)

    // 全ツールが登録されている
    for (const expected of EXPECTED_TOOLS) {
      expect(toolNames).toContain(expected)
    }

    // 重複がない
    const unique = new Set(toolNames)
    expect(unique.size).toBe(toolNames.length)

    // 期待数と一致
    expect(toolNames.length).toBe(EXPECTED_TOOLS.length)

    proc.kill()
  })

  test("each tool has a description", async () => {
    const proc = Bun.spawn(["bun", "run", "index.ts"], {
      cwd: import.meta.dir.replace("/test", ""),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "ignore",
    })

    const initRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0.1.0" },
      },
    })

    const listRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    })

    proc.stdin.write(`${initRequest}\n${listRequest}\n`)
    proc.stdin.end()

    const output = await new Response(proc.stdout).text()
    const lines = output.trim().split("\n")
    const toolsResponse = JSON.parse(lines[1])
    const tools: Array<{ name: string; description?: string }> = toolsResponse.result.tools

    for (const tool of tools) {
      expect(tool.description).toBeDefined()
      expect(tool.description!.length).toBeGreaterThan(0)
    }

    proc.kill()
  })

  test("tools have proper input schemas", async () => {
    const proc = Bun.spawn(["bun", "run", "index.ts"], {
      cwd: import.meta.dir.replace("/test", ""),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "ignore",
    })

    const initRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0.1.0" },
      },
    })

    const listRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    })

    proc.stdin.write(`${initRequest}\n${listRequest}\n`)
    proc.stdin.end()

    const output = await new Response(proc.stdout).text()
    const lines = output.trim().split("\n")
    const toolsResponse = JSON.parse(lines[1])
    const tools: Array<{ name: string; inputSchema: Record<string, unknown> }> =
      toolsResponse.result.tools

    // 必須パラメータを持つツールの検証
    const requiresId = [
      "performance_goals_show",
      "performance_goals_update",
      "performance_goals_delete",
      "performance_goals_evaluate",
      "evaluation_sheets_show",
      "evaluation_sheets_transition",
      "evaluation_sheets_evaluators",
    ]

    for (const toolName of requiresId) {
      const tool = tools.find((t) => t.name === toolName)
      expect(tool).toBeDefined()

      const required = tool!.inputSchema.required as string[]
      expect(required.length).toBeGreaterThan(0)
    }

    // evaluation_sheets_create は employee_id と period が必須
    const createTool = tools.find((t) => t.name === "evaluation_sheets_create")
    expect(createTool).toBeDefined()

    const createRequired = createTool!.inputSchema.required as string[]
    expect(createRequired).toContain("employee_id")
    expect(createRequired).toContain("period")

    proc.kill()
  })
})
