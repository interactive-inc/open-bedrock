import { app } from "@/app/index"
import { describe, expect, it } from "bun:test"

describe("payroll issue", () => {
  it("shows help", async () => {
    const response = await app.request("/payroll/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("payroll issue")
  })

  it("rejects a non-numeric --base before sending to the API", async () => {
    const response = await app.request("/payroll/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "employee-code": "E001", period: "2026-05", base: "abc" }),
    })

    expect(response.status).toBe(400)

    expect(await response.text()).toContain("base")
  })
})
