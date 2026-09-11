import { afterEach, beforeEach, expect, spyOn, test } from "bun:test"
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

test.each(["approve", "reject", "complete", "cancel"])(
  "休暇の確認対象をそのまま一回送る: %s",
  async (operation) => {
    const response = await command("/leave-requests/procedure", {
      id: "42",
      operation,
      "decision-target": JSON.stringify(target),
      comment: "確認済み",
    })
    expect(response.status).toBe(200)
    expect(requests).toHaveLength(1)
    const request = requests[0]
    if (request === undefined) throw new Error("request missing")
    expect(new URL(request.url).pathname).toBe(
      `/leave/leave-requests/42/procedure/${operation === "approve" || operation === "reject" ? "decisions" : operation}`,
    )
    expect(await request.json()).toEqual({
      decision_target: target,
      ...(["approve", "reject"].includes(operation)
        ? { action: operation, comment: "確認済み" }
        : {}),
    })
  },
)

test("判断対象の欠落・不正な差戻し元ではAPIを呼ばない", async () => {
  expect(
    (await command("/leave-requests/procedure", { id: "42", operation: "approve" })).status,
  ).toBe(400)
  expect(
    (
      await command("/leave-requests/procedure", {
        id: "42",
        operation: "submit",
        "previous-leave-request-id": "-1",
      })
    ).status,
  ).toBe(400)
  expect(requests).toHaveLength(0)
})

test("提出のrequest key・確認digest・差戻し元を再送でも保持する", async () => {
  const key = "12345678-1234-4234-8234-123456789abc"
  const args = {
    id: "42",
    operation: "submit",
    "request-key": key,
    "content-digest": target.proposal_digest,
    "previous-leave-request-id": "41",
  }
  expect((await command("/leave-requests/procedure", args)).status).toBe(200)
  expect((await command("/leave-requests/procedure", args)).status).toBe(200)
  expect(requests).toHaveLength(2)
  for (const request of requests)
    expect(await request.json()).toEqual({
      request_key: key,
      confirmed_content_digest: target.proposal_digest,
      previous_leave_request_id: 41,
    })
})

test("休暇規程の書き込みには確認した版が必要", async () => {
  expect((await command("/leave-procedures", { definition: "{}" })).status).toBe(400)
  expect(requests).toHaveLength(0)
  expect(
    (
      await command("/leave-procedures", {
        definition: '{"version":1,"steps":[]}',
        "expected-revision": "3",
      })
    ).status,
  ).toBe(200)
  expect(requests).toHaveLength(1)
  const request = requests[0]
  if (request === undefined) throw new Error("request missing")
  expect(request.method).toBe("PUT")
  expect(new URL(request.url).pathname).toBe("/leave/leave-procedures")
  expect(await request.json()).toEqual({
    expected_revision: 3,
    workflow: { version: 1, steps: [] },
  })
})
