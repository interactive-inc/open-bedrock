import { describe, expect, it } from "bun:test"
import { app } from "@/app/index"

const paths: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/position-definitions", help: "bedrock position-definitions" },
  { path: "/position-definitions/list", help: "position-definitions list" },
  { path: "/position-definitions/create", help: "position-definitions create" },
  { path: "/position-definitions/update", help: "position-definitions update" },
  { path: "/position-definitions/delete", help: "position-definitions delete" },
]

describe("positions commands", () => {
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

  it("positions create requires --code, --name, --rank", async () => {
    const response = await app.request("/position-definitions/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Lead" }),
    })

    expect(response.status).not.toBe(200)
  })
})
