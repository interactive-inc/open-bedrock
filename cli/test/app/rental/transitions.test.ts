import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

async function helpText(path: string): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ help: "1" }),
  })
}

describe("rental transitions", () => {
  it("lend shows help", async () => {
    const response = await helpText("/rental/lend")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("rental lend")
  })

  it("return shows help", async () => {
    const response = await helpText("/rental/return")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("rental return")
  })
})
