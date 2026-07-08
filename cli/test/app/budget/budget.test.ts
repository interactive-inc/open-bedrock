import { describe, expect, test } from "bun:test"
import { app } from "@/app/index"

// budget 各サブコマンドが app/index.ts に登録され、help が返る（catch-all に落ちない）ことを確認する。
const routes: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/budget", help: "karte budget" },
  { path: "/budget/list", help: "budget list" },
  { path: "/budget/summary", help: "budget summary" },
  { path: "/budget/create", help: "budget create" },
  { path: "/budget/show", help: "budget show" },
  { path: "/budget/update", help: "budget update" },
  { path: "/budget/delete", help: "budget delete" },
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
