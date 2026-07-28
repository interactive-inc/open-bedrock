import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("shift assignments", () => {
  it("shows help", async () => {
    const response = await app.request("/shift-assignments/list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("シフト割当一覧")
  })
})
