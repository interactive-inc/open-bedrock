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
    const response = await helpText("/ringi-requests")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("bedrock ringi-requests")
  })

  it("submit shows help", async () => {
    const response = await helpText("/ringi-requests/submit")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("ringi-requests submit")
  })

  it("me shows help", async () => {
    const response = await helpText("/ringi-requests/me")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("ringi-requests me")
  })

  it("inbox shows help", async () => {
    const response = await helpText("/ringi-requests/inbox")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("ringi-requests inbox")
  })
})
