import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/meetings", help: "bedrock meetings" },
  { path: "/meetings/list", help: "meetings list" },
  { path: "/meetings/show", help: "meetings show" },
  { path: "/meetings/create", help: "meetings create" },
  { path: "/meetings/update", help: "meetings update" },
  { path: "/meetings/archive", help: "meetings archive" },
  { path: "/meeting-minutes-records", help: "bedrock meeting-minutes-records" },
  { path: "/meeting-minutes-records/list", help: "meeting-minutes-records list" },
  { path: "/meeting-minutes-records/show", help: "meeting-minutes-records show" },
  { path: "/meeting-minutes-records/add", help: "meeting-minutes-records add" },
  { path: "/meeting-minutes-records/edit", help: "meeting-minutes-records edit" },
  { path: "/decision-records", help: "bedrock decision-records" },
  { path: "/decision-records/list", help: "decision-records list" },
  { path: "/decision-records/show", help: "decision-records show" },
  { path: "/decision-records/create", help: "decision-records create" },
  { path: "/decision-records/update", help: "decision-records update" },
  { path: "/decision-records/supersede", help: "decision-records supersede" },
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
    const response = await app.request("/decision-records/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("decisions supersede requires --by", async () => {
    const response = await app.request("/decision-records/supersede/1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(response.status).not.toBe(200)
  })
})
