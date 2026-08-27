import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("training course-create", () => {
  it("shows help", async () => {
    const response = await app.request("/training-courses/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("training-courses create")
  })

  it("errors without required flags", async () => {
    const response = await app.request("/training-courses/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "SEC-101" }),
    })

    expect(response.status).toBe(400)

    const text = await response.text()

    expect(text).toContain("title")
  })
})
