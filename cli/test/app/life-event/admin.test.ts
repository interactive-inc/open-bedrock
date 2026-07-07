import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("life-event admin", () => {
  it("shows help", async () => {
    const response = await app.request("/life-event/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("life-event admin")
  })
})
