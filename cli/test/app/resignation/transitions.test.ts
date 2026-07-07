import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

async function helpText(path: string): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ help: "1" }),
  })
}

describe("resignation transitions", () => {
  it("accept shows help", async () => {
    const response = await helpText("/resignation/accept")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("resignation accept")
  })

  it("reject shows help", async () => {
    const response = await helpText("/resignation/reject")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("resignation reject")
  })
})
