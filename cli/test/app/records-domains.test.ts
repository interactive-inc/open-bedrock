import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/announcements", help: "karte announcements" },
  { path: "/announcements/list", help: "announcements list" },
  { path: "/announcements/show", help: "announcements show" },
  { path: "/announcements/create", help: "announcements create" },
  { path: "/announcements/update", help: "announcements update" },
  { path: "/announcements/publish", help: "announcements publish" },
  { path: "/announcements/archive", help: "announcements archive" },
  { path: "/regulations", help: "karte regulations" },
  { path: "/regulations/list", help: "regulations list" },
  { path: "/regulations/show", help: "regulations show" },
  { path: "/regulations/register", help: "regulations register" },
  { path: "/regulations/add-version", help: "regulations add-version" },
  { path: "/regulations/archive", help: "regulations archive" },
  { path: "/documents", help: "karte documents" },
  { path: "/documents/list", help: "documents list" },
  { path: "/documents/register", help: "documents register" },
  { path: "/documents/update", help: "documents update" },
]

describe("announcements/regulations/documents commands", () => {
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

  it("announcements create requires --title and --body", async () => {
    const response = await app.request("/announcements/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("announcements show requires <id>", async () => {
    const response = await app.request("/announcements/show", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(response.status).not.toBe(200)
  })

  it("regulations register requires the core fields", async () => {
    const response = await app.request("/regulations/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "REG-X", title: "x" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("regulations add-version requires <code>", async () => {
    const response = await app.request("/regulations/add-version", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "x", "effective-on": "2026-01-01" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("documents register requires --title and --location", async () => {
    const response = await app.request("/documents/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("documents update requires <id>", async () => {
    const response = await app.request("/documents/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x", location: "y" }),
    })

    expect(response.status).not.toBe(200)
  })
})
