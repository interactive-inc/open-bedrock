import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/recruitment", help: "karte recruitment" },
  { path: "/recruitment/positions", help: "recruitment positions" },
  { path: "/recruitment/position-create", help: "recruitment position-create" },
  { path: "/recruitment/position-update", help: "recruitment position-update" },
  { path: "/recruitment/candidates", help: "recruitment candidates" },
  { path: "/recruitment/candidate-add", help: "recruitment candidate-add" },
  { path: "/recruitment/advance", help: "recruitment advance" },
  { path: "/commendations", help: "karte commendations" },
  { path: "/commendations/list", help: "commendations list" },
  { path: "/commendations/create", help: "commendations create" },
  { path: "/commendations/delete", help: "commendations delete" },
  { path: "/disciplinary-actions", help: "karte disciplinary-actions" },
  { path: "/disciplinary-actions/list", help: "disciplinary-actions list" },
  { path: "/disciplinary-actions/create", help: "disciplinary-actions create" },
  { path: "/headcount-plans", help: "karte headcount-plans" },
  { path: "/headcount-plans/list", help: "headcount-plans list" },
  { path: "/headcount-plans/create", help: "headcount-plans create" },
  { path: "/headcount-plans/update", help: "headcount-plans update" },
]

describe("recruitment / commendations / disciplinary-actions / headcount-plans commands", () => {
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

  it("recruitment position-create requires --title", async () => {
    const response = await app.request("/recruitment/position-create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(response.status).not.toBe(200)
  })

  it("recruitment advance requires <candidate_id>", async () => {
    const response = await app.request("/recruitment/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: "screening" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("commendations create requires the core fields", async () => {
    const response = await app.request("/commendations/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("disciplinary-actions create requires the core fields", async () => {
    const response = await app.request("/disciplinary-actions/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "warning" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("headcount-plans create requires --fiscal-year and --planned-count", async () => {
    const response = await app.request("/headcount-plans/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "fiscal-year": "2026" }),
    })

    expect(response.status).not.toBe(200)
  })

  it("headcount-plans update requires <id>", async () => {
    const response = await app.request("/headcount-plans/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "planned-count": "5" }),
    })

    expect(response.status).not.toBe(200)
  })
})
