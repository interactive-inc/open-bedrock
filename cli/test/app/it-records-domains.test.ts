import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

/**
 * licenses / it-incidents / salary-revisions コマンド群の到達性と help を検証する。
 * 未登録だと catch-all に落ちて help が返らず実質使用不可になるため、基底パスへの
 * POST + help:1 で到達性を確かめる。
 */
const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/licenses", help: "karte licenses" },
  { path: "/licenses/list", help: "licenses list" },
  { path: "/licenses/create", help: "licenses create" },
  { path: "/licenses/update", help: "licenses update" },
  { path: "/licenses/cancel", help: "licenses cancel" },
  { path: "/it-incidents", help: "karte it-incidents" },
  { path: "/it-incidents/list", help: "it-incidents list" },
  { path: "/it-incidents/create", help: "it-incidents create" },
  { path: "/it-incidents/resolve", help: "it-incidents resolve" },
  { path: "/salary-revisions", help: "karte salary-revisions" },
  { path: "/salary-revisions/list", help: "salary-revisions list" },
  { path: "/salary-revisions/create", help: "salary-revisions create" },
]

describe("it/records domains commands", () => {
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

  it("licenses create requires --name", async () => {
    const response = await app.request("/licenses/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vendor: "x" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("it-incidents create requires the core fields", async () => {
    const response = await app.request("/it-incidents/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("salary-revisions list requires --employee-id", async () => {
    const response = await app.request("/salary-revisions/list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(response.status).not.toBe(200)
  })

  it("salary-revisions create requires the core fields", async () => {
    const response = await app.request("/salary-revisions/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "employee-id": "1" }),
    })

    expect(response.status).not.toBe(200)
  })
})
