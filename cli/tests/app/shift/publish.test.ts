import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("shift publish", () => {
  it("shows help", async () => {
    const response = await app.request("/shift-assignments/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    const text = await response.text()

    expect(text).toContain("公開")
  })

  it("errors without id", async () => {
    const response = await app.request("/shift-assignments/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(400)

    const text = await response.text()

    expect(text).toContain("引数")
  })
})
