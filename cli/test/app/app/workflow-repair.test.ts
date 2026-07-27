import { app } from "@/app/index"
import { describe, expect, test } from "bun:test"

describe("app workflow-repair commands", () => {
  test("registers the list command", async () => {
    const response = await request("/application-requests/workflow-repair/list", { help: "1" })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain("application-requests workflow-repair list")
  })

  test("registers the reassign command", async () => {
    const response = await request("/application-requests/workflow-repair/reassign", { help: "1" })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain("application-requests workflow-repair reassign")
  })

  test("requires an application id, candidates, and reason", async () => {
    const response = await request("/application-requests/workflow-repair/reassign", {
      candidates: "2,3",
    })

    expect(response.status).toBe(400)
    expect(await response.text()).toContain("app_id と --candidates と --reason が必要です")
  })

  test("rejects invalid candidate IDs before calling the API", async () => {
    const response = await request("/application-requests/workflow-repair/reassign/42", {
      candidates: "2,invalid",
      reason: "restore approvers",
    })

    expect(response.status).toBe(400)
    expect(await response.text()).toContain("--candidates は正の従業員 ID")
  })

  test("rejects an invalid explicit quorum before calling the API", async () => {
    const response = await request("/application-requests/workflow-repair/reassign/42", {
      candidates: "2,3",
      reason: "restore approvers",
      "required-approvals": "0",
    })

    expect(response.status).toBe(400)
    expect(await response.text()).toContain("--required-approvals は 1〜20 の整数")
  })
})

async function request(path: string, body: Record<string, string>): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
