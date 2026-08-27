import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

async function helpText(path: string): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ help: "1" }),
  })
}

describe("business-trip transitions", () => {
  it("approve shows help", async () => {
    const response = await helpText("/business-trips/approve")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("business-trips approve")
  })

  it("reject shows help", async () => {
    const response = await helpText("/business-trips/reject")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("business-trips reject")
  })
})
