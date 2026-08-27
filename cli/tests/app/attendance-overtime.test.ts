import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

describe("attendance overtime command", () => {
  it("POST /attendance/overtime is reachable and returns its help", async () => {
    const response = await app.request("/attendance-records/overtime", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "1" }),
    })

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("attendance-records overtime")
  })
})
