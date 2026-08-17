import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { COMPANY_CORE_CAPABILITIES, GET } from "./route"

describe("GET /company/v1/capabilities", () => {
  test("portable Company coreの全能力を安定した順序で公開する", async () => {
    const response = await new Hono()
      .get("/company/v1/capabilities", ...GET)
      .request("/company/v1/capabilities")

    expect(response.status).toBe(200)
    expect((await response.json()) as unknown).toEqual({
      apiVersion: "company/v1",
      capabilities: COMPANY_CORE_CAPABILITIES,
    })
  })
})
