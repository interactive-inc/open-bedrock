import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

async function helpText(path: string): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ help: "1" }),
  })
}

describe("family-care-leave transitions", () => {
  it("approve shows help", async () => {
    const response = await helpText("/family-care-leaves/approve")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("family-care-leaves approve")
  })

  it("cancel-approval shows help", async () => {
    const response = await helpText("/family-care-leaves/cancel-approval")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("family-care-leaves cancel-approval")
  })
})
