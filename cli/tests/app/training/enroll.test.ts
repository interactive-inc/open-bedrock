import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("training enroll", () => {
  it("shows help", async () => {
    const response = await app.request("/training-enrollments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("training-enrollments create")
  })

  it("errors without course", async () => {
    const response = await app.request("/training-enrollments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ due: "2026-12-31" }),
    })

    expect(response.status).toBe(400)

    const text = await response.text()

    expect(text).toContain("course")
  })
})
