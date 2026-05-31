import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("shift assign", () => {
  it("shows help", async () => {
    const response = await app.request("/shift/assign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("shift assign")
  })

  it("errors without required flags", async () => {
    const response = await app.request("/shift/assign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-06-01" }),
    })

    expect(response.status).toBe(400)

    const text = await response.text()

    expect(text).toContain("必要です")
  })
})
