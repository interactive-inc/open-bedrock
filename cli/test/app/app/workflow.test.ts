import { app } from "@/app/index"
import { describe, expect, test } from "bun:test"

describe("app workflow command", () => {
  test("documents the revision required for an update", async () => {
    const response = await request("/app/workflow/paid_leave", { help: "1" })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain("--expected-revision")
  })

  test("requires an expected revision before sending a definition", async () => {
    const response = await request("/app/workflow/paid_leave", {
      definition: '{"version":1,"steps":[]}',
    })

    expect(response.status).toBe(400)
    expect(await response.text()).toContain("--expected-revision が必要です")
  })
})

async function request(path: string, body: Record<string, string>): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
