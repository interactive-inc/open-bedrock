import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { app } from "@/app/index"
import { SettingsFile } from "@/lib/config/settings-file"

const target = { request_id: 42, request_digest: "a".repeat(64) }
let responseStatus = 200
let tokenSpy: ReturnType<typeof spyOn<SettingsFile, "tokensFor">>
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>
const requests: Request[] = []

beforeEach(() => {
  requests.length = 0
  responseStatus = 200
  tokenSpy = spyOn(SettingsFile.prototype, "tokensFor").mockResolvedValue({
    token: "test-access-token",
    refresh_token: null,
  })
  const fetcher = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      requests.push(
        input instanceof Request ? new Request(input, init) : new Request(String(input), init),
      )
      return Response.json(
        { status: "pending", message: "the leave request changed; review it again" },
        { status: responseStatus },
      )
    },
    { preconnect: fetch.preconnect },
  )
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(fetcher)
})
afterEach(() => {
  fetchSpy.mockRestore()
  tokenSpy.mockRestore()
})
function command(path: string, args: Record<string, string>) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  })
}

describe("休暇CLIの確認対象", () => {
  test.each(["approve", "reject"])("確認した対象を一度だけ送信する: %s", async (operation) => {
    const response = await command(`/leave-requests/${operation}/42`, {
      "decision-target": JSON.stringify(target),
      comment: "確認済み",
    })
    expect(response.status).toBe(200)
    expect(requests).toHaveLength(1)
    expect(new URL(requests[0]!.url).pathname).toBe(`/leave/leave-requests/42/${operation}`)
    expect(requests[0]!.method).toBe("POST")
    expect(await requests[0]!.json()).toEqual({ comment: "確認済み", decision_target: target })
  })
  test.each(["approve", "reject"])(
    "確認対象が欠けていてもhelpを表示する: %s",
    async (operation) => {
      const response = await command(`/leave-requests/${operation}/42`, { help: "1" })
      expect(response.status).toBe(200)
      expect(await response.text()).toContain("--decision-target")
      expect(requests).toHaveLength(0)
    },
  )
  test.each([
    undefined,
    "broken",
    "null",
    "{}",
    JSON.stringify({ ...target, request_id: 43 }),
    JSON.stringify({ ...target, request_digest: "bad" }),
  ])("確認対象が不正ならAPIを呼ばない: %s", async (value) => {
    for (const operation of ["approve", "reject"]) {
      const args: Record<string, string> = { comment: "確認済み" }
      if (value !== undefined) args["decision-target"] = value
      expect((await command(`/leave-requests/${operation}/42`, args)).status).toBe(400)
    }
    expect(requests).toHaveLength(0)
  })
  test.each(["approve", "reject"])(
    "競合時も最新の対象を取得して再送しない: %s",
    async (operation) => {
      responseStatus = 409
      const response = await command(`/leave-requests/${operation}/42`, {
        "decision-target": JSON.stringify(target),
        comment: "確認済み",
      })
      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(requests).toHaveLength(1)
      expect(await requests[0]!.json()).toEqual({ comment: "確認済み", decision_target: target })
    },
  )
})
