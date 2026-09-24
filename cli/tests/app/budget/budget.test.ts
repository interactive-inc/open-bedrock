import { describe, expect, test } from "bun:test"
import { app } from "@/app/index"

/** budget 各サブコマンドが app/index.ts に登録され、help が返る（catch-all に落ちない）ことを確認する。 */
const routes: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/expense-budgets", help: "bedrock expense-budgets" },
  { path: "/expense-budgets/list", help: "expense-budgets list" },
  { path: "/expense-budgets/summary", help: "expense-budgets summary" },
  { path: "/expense-budgets/create", help: "expense-budgets create" },
  { path: "/expense-budgets/show", help: "expense-budgets show" },
  { path: "/expense-budgets/update", help: "expense-budgets update" },
  { path: "/expense-budgets/delete", help: "expense-budgets delete" },
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
