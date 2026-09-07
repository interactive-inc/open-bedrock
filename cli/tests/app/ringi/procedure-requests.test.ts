import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { app } from "@/app/index"
import { SettingsFile } from "@/lib/config/settings-file"

const target = {
  proposal_version: 3,
  proposal_digest: "a".repeat(64),
  task_key: "review",
  task_round: 2,
}
let tokenSpy: ReturnType<typeof spyOn<SettingsFile, "tokensFor">>
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>
const requests: Request[] = []

beforeEach(() => {
  requests.length = 0
  tokenSpy = spyOn(SettingsFile.prototype, "tokensFor").mockResolvedValue({
    token: "test-access-token",
    refresh_token: null,
  })
  const fetcher = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      requests.push(
        input instanceof Request ? new Request(input, init) : new Request(String(input), init),
      )
      return Response.json({ status: "pending" })
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

describe("稟議CLIの確認対象と再送", () => {
  test.each(["approve", "reject", "cancel", "execute"])(
    "確認した対象を一回だけ送る: %s",
    async (operation) => {
      const response = await command(`/ringi-requests/${operation}/42`, {
        "decision-target": JSON.stringify(target),
        comment: "確認済み",
      })
      expect(response.status).toBe(200)
      expect(requests).toHaveLength(1)
      const request = requests[0]!
      expect(new URL(request.url).pathname).toBe(`/ringi/ringi-requests/42/${operation}`)
      expect(request.method).toBe("POST")
      expect(request.headers.get("authorization")).toBe("Bearer test-access-token")
      expect(await request.json()).toEqual({
        decision_target: target,
        ...(["approve", "reject"].includes(operation) ? { comment: "確認済み" } : {}),
      })
    },
  )

  test("判断対象がない場合はAPIを呼ばない", async () => {
    const response = await command("/ringi-requests/approve/42", {})
    expect(response.status).toBe(400)
    expect(requests).toHaveLength(0)
  })

  test("提出の再送キーと差戻し元をそのまま渡す", async () => {
    const key = "12345678-1234-4234-8234-123456789abc"
    const args = {
      "request-key": key,
      "previous-ringi-id": "41",
      "approver-id": "reviewer",
      title: "備品購入",
      amount: "1000",
      reason: "設備更新",
    }
    for (let attempt = 0; attempt < 2; attempt++)
      expect((await command("/ringi-requests/submit", args)).status).toBe(200)
    expect(requests).toHaveLength(2)
    for (const request of requests) {
      expect(new URL(request.url).pathname).toBe("/ringi/ringi-requests")
      expect(await request.json()).toEqual({
        request_key: key,
        previous_ringi_id: 41,
        existing_ringi_id: null,
        approver_id: "reviewer",
        title: "備品購入",
        amount: 1000,
        reason: "設備更新",
      })
    }
  })
})
