import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("training course", () => {
  it("shows help", async () => {
    const response = await app.request("/training/course", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("training course")
  })

  it("errors without code", async () => {
    const response = await app.request("/training/course", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(400)

    const text = await response.text()

    expect(text).toContain("code")
  })
})
