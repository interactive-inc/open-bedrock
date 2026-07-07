import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("audit-logs", () => {
  it("shows help", async () => {
    const response = await app.request("/audit-logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("audit-logs")
  })
})
