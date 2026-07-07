import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

async function helpText(path: string): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ help: "1" }),
  })
}

describe("life-event transitions", () => {
  it("approve shows help", async () => {
    const response = await helpText("/life-event/approve")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("life-event approve")
  })

  it("reject shows help", async () => {
    const response = await helpText("/life-event/reject")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("life-event reject")
  })
})
