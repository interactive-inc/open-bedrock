import { describe, expect, test } from "bun:test"
import { COMPANY_CORE_CAPABILITIES } from "@/contexts/company/interface/capabilities/company-capabilities"
import { Hono } from "hono"
import { hc } from "hono/client"
import { GET } from "./company.v1.capabilities"

describe("GET /company/v1/capabilities", () => {
  test("portable Company coreの全能力を安定した順序で公開する", async () => {
    const app = new Hono().get("/company/v1/capabilities", ...GET)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) => app.request(input, init)
    const client = hc<typeof app>("http://company.test", { fetch: request })

    const response = await client.company.v1.capabilities.$get()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      apiVersion: "company/v1",
      capabilities: COMPANY_CORE_CAPABILITIES,
    })
  })
})
