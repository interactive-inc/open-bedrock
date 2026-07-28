import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/employee-work-styles", help: "bedrock employee-work-styles" },
  { path: "/employee-work-styles/list", help: "employee-work-styles list" },
  { path: "/employee-work-styles/add", help: "employee-work-styles add" },
]

describe("work-styles commands", () => {
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

  it("work-styles add requires --employee-id, --style, --starts-on", async () => {
    const response = await app.request("/employee-work-styles/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ style: "flextime" }),
    })

    expect(response.status).not.toBe(200)
  })
})
