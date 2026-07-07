import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/calendar", help: "karte calendar" },
  { path: "/calendar/list", help: "calendar list" },
  { path: "/calendar/add", help: "calendar add" },
  { path: "/calendar/delete", help: "calendar delete" },
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
    const response = await app.request("/calendar/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "元日" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("calendar delete requires --id", async () => {
    const response = await app.request("/calendar/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(response.status).not.toBe(200)
  })
})
