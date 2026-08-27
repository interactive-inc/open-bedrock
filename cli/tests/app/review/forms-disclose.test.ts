import { app } from "@/app/index"
import { describe, expect, test } from "bun:test"

async function requestJson(path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

/**
 * review forms / forms-bulk / disclose コマンドの到達性と引数検証を確認する。
 * help と引数検証は API 呼び出し前に返るため、実リクエストなしでテストできる
 */
describe("review forms/forms-bulk/disclose", () => {
  const helpRoutes: ReadonlyArray<{ path: string; help: string }> = [
    { path: "/review-forms/list", help: "review-forms list" },
    { path: "/review-forms/bulk", help: "review-forms bulk" },
    { path: "/review-cycles/disclose", help: "review-cycles disclose" },
  ]

  for (const route of helpRoutes) {
    test(`POST ${route.path} is reachable and returns its help`, async () => {
      const response = await requestJson(route.path, { help: "1" })

      expect(response.status).toBe(200)

      expect(await response.text()).toContain(route.help)
    })
  }

  test("review forms requires --subject-employee-id", async () => {
    const response = await requestJson("/review-forms/list", {})

    expect(response.status).toBe(400)
  })

  test("review forms-bulk requires --cycle-id", async () => {
    const response = await requestJson("/review-forms/bulk", { forms: "forms.json" })

    expect(response.status).toBe(400)
  })

  test("review forms-bulk requires --forms", async () => {
    const response = await requestJson("/review-forms/bulk", { "cycle-id": "1" })

    expect(response.status).toBe(400)
  })

  test("review disclose requires --cycle-id", async () => {
    const response = await requestJson("/review-cycles/disclose", {})

    expect(response.status).toBe(400)
  })
})
