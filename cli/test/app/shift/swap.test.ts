import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("shift swap", () => {
  it("shows help", async () => {
    const response = await app.request("/shift/swap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("shift swap")
  })

  it("errors without required flags", async () => {
    const response = await app.request("/shift/swap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "メモ" }),
    })

    expect(response.status).toBe(400)

    const text = await response.text()

    expect(text).toContain("必要です")
  })
})
