import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/meetings", help: "bedrock meetings" },
  { path: "/meetings/list", help: "meetings list" },
  { path: "/meetings/show", help: "meetings show" },
  { path: "/meetings/create", help: "meetings create" },
  { path: "/meetings/update", help: "meetings update" },
  { path: "/meetings/archive", help: "meetings archive" },
  { path: "/minutes", help: "bedrock minutes" },
  { path: "/minutes/list", help: "minutes list" },
  { path: "/minutes/show", help: "minutes show" },
  { path: "/minutes/add", help: "minutes add" },
  { path: "/minutes/edit", help: "minutes edit" },
  { path: "/decisions", help: "bedrock decisions" },
  { path: "/decisions/list", help: "decisions list" },
  { path: "/decisions/show", help: "decisions show" },
  { path: "/decisions/create", help: "decisions create" },
  { path: "/decisions/update", help: "decisions update" },
  { path: "/decisions/supersede", help: "decisions supersede" },
]

describe("meetings/minutes/decisions commands", () => {
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

  it("meetings create requires --code and --name", async () => {
    const response = await app.request("/meetings/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "経営会議" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("decisions create requires the core fields", async () => {
    const response = await app.request("/decisions/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("decisions supersede requires --by", async () => {
    const response = await app.request("/decisions/supersede/1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(response.status).not.toBe(200)
  })
})
