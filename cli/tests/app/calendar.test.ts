import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/company-calendar-days", help: "bedrock company-calendar-days" },
  { path: "/company-calendar-days/list", help: "company-calendar-days list" },
  { path: "/company-calendar-days/add", help: "company-calendar-days add" },
  { path: "/company-calendar-days/delete", help: "company-calendar-days delete" },
]

describe("calendar commands", () => {
  for (const route of paths) {
    it(`POST ${route.path} is reachable and returns its help`, async () => {
      const response = await app.request(route.path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ help: "1" }),
      })

      expect(response.status).toBe(200)

      expect(await response.text()).toContain(route.help)
    })
  }

  it("calendar add requires --date and --kind", async () => {
    const response = await app.request("/company-calendar-days/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "元日" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("calendar delete requires --id", async () => {
    const response = await app.request("/company-calendar-days/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(response.status).not.toBe(200)
  })
})
