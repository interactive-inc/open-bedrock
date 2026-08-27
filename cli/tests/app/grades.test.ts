import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/grade-definitions", help: "bedrock grade-definitions" },
  { path: "/grade-definitions/list", help: "grade-definitions list" },
  { path: "/grade-definitions/create", help: "grade-definitions create" },
  { path: "/grade-definitions/update", help: "grade-definitions update" },
  { path: "/grade-definitions/delete", help: "grade-definitions delete" },
  { path: "/employee-grades/list", help: "employee-grades list" },
  { path: "/employee-grades/create", help: "employee-grades create" },
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
    const response = await app.request("/grade-definitions/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Lead" }),
    })

    expect(response.status).not.toBe(200)
  })
})
