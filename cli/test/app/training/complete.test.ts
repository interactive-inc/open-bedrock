import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("training complete", () => {
  it("shows help", async () => {
    const response = await app.request("/training/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("training complete")
  })

  it("errors without id", async () => {
    const response = await app.request("/training/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ score: "80" }),
    })

    expect(response.status).toBe(400)

    const text = await response.text()

    expect(text).toContain("id")
  })
})
