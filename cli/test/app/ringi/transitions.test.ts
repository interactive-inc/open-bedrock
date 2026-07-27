import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

async function helpText(path: string): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ help: "1" }),
  })
}

describe("ringi transitions", () => {
  it("approve shows help", async () => {
    const response = await helpText("/ringi-requests/approve")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("ringi-requests approve")
  })

  it("reject shows help", async () => {
    const response = await helpText("/ringi-requests/reject")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("ringi-requests reject")
  })
})
