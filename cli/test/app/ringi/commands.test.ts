import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

async function helpText(path: string): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ help: "1" }),
  })
}

describe("ringi commands", () => {
  it("group shows help", async () => {
    const response = await helpText("/ringi")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("bedrock ringi")
  })

  it("submit shows help", async () => {
    const response = await helpText("/ringi/submit")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("ringi submit")
  })

  it("me shows help", async () => {
    const response = await helpText("/ringi/me")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("ringi me")
  })

  it("inbox shows help", async () => {
    const response = await helpText("/ringi/inbox")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("ringi inbox")
  })
})
