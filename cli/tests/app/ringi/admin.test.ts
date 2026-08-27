import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("ringi admin", () => {
  it("shows help", async () => {
    const response = await app.request("/ringi-requests/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("ringi-requests admin")
  })
})
