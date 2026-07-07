import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/employee-events", help: "karte employee-events" },
  { path: "/employee-events/list", help: "employee-events list" },
  { path: "/employee-events/record", help: "employee-events record" },
]

describe("employee-events commands", () => {
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

  it("employee-events record rejects an unknown kind", async () => {
    const response = await app.request("/employee-events/record", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        "employee-id": "5",
        kind: "promotion",
        "effective-date": "2026-06-01",
      }),
    })

    expect(response.status).not.toBe(200)
  })
})
