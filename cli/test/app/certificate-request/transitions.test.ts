import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

async function helpText(path: string): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ help: "1" }),
  })
}

describe("certificate-request transitions", () => {
  it("issue shows help", async () => {
    const response = await helpText("/certificate-request/issue")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("certificate-request issue")
  })

  it("reject shows help", async () => {
    const response = await helpText("/certificate-request/reject")

    expect(response.status).toBe(200)

    expect(await response.text()).toContain("certificate-request reject")
  })
})
