import { describe, expect, test } from "bun:test"
import { app } from "@/app/index"

/** budget 各サブコマンドが app/index.ts に登録され、help が返る（catch-all に落ちない）ことを確認する。 */
const routes: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/department-budgets", help: "bedrock department-budgets" },
  { path: "/department-budgets/list", help: "department-budgets list" },
  { path: "/department-budgets/summary", help: "department-budgets summary" },
  { path: "/department-budgets/create", help: "department-budgets create" },
  { path: "/department-budgets/show", help: "department-budgets show" },
  { path: "/department-budgets/update", help: "department-budgets update" },
  { path: "/department-budgets/delete", help: "department-budgets delete" },
]

describe("budget command registration", () => {
  for (const route of routes) {
    test(`POST ${route.path} is reachable and returns its help`, async () => {
      const response = await app.request(route.path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ help: "1" }),
      })

      expect(response.status).toBe(200)

      expect(await response.text()).toContain(route.help)
    })
  }
})
