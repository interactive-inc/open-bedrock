import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/grades", help: "karte grades" },
  { path: "/grades/list", help: "grades list" },
  { path: "/grades/create", help: "grades create" },
  { path: "/grades/update", help: "grades update" },
  { path: "/grades/delete", help: "grades delete" },
  { path: "/grades/assignments", help: "grades assignments" },
  { path: "/grades/assign", help: "grades assign" },
]

describe("grades commands", () => {
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

  it("grades create requires --code, --name, --rank", async () => {
    const response = await app.request("/grades/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Lead" }),
    })

    expect(response.status).not.toBe(200)
  })
})
