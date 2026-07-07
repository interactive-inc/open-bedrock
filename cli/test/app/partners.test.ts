import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/partners", help: "karte partners" },
  { path: "/partners/list", help: "partners list" },
  { path: "/partners/show", help: "partners show" },
  { path: "/partners/register", help: "partners register" },
  { path: "/partners/update", help: "partners update" },
  { path: "/partners/archive", help: "partners archive" },
  { path: "/contracts", help: "karte contracts" },
  { path: "/contracts/list", help: "contracts list" },
  { path: "/contracts/create", help: "contracts create" },
  { path: "/contracts/update", help: "contracts update" },
]

describe("partners/contracts commands", () => {
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

  it("partners register requires --code and --name", async () => {
    const response = await app.request("/partners/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Acme" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("partners update requires <id>", async () => {
    const response = await app.request("/partners/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Acme" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("contracts create requires the core fields", async () => {
    const response = await app.request("/contracts/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("contracts update requires <id>", async () => {
    const response = await app.request("/contracts/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x", "contract-date": "2026-01-01" }),
    })

    expect(response.status).not.toBe(200)
  })
})
