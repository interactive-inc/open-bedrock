import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("training enrollments", () => {
  it("shows help", async () => {
    const response = await app.request("/training-enrollments/list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("training-enrollments list")
  })
})
