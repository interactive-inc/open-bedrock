import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("training courses", () => {
  it("shows help", async () => {
    const response = await app.request("/training-courses/list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("training-courses list")
  })
})
