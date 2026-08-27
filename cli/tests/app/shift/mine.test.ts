import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("shift mine", () => {
  it("shows help", async () => {
    const response = await app.request("/shift-assignments/mine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("自分のシフト割当一覧")
  })
})
