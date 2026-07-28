import { app } from "@/app/index"
import { describe, expect, test } from "bun:test"

/**
 * review cycle open / close コマンドの到達性と引数検証を確認する。
 * help は API 呼び出し前に返るため、--id 検証も実リクエストなしでテストできる。
 */
const cycleStatusRoutes: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/review-cycles/open", help: "review-cycles open" },
  { path: "/review-cycles/close", help: "review-cycles close" },
]

describe("review cycle open/close", () => {
  for (const route of cycleStatusRoutes) {
    test(`POST ${route.path} is reachable and returns its help`, async () => {
      const response = await app.request(route.path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ help: "1" }),
      })

      expect(response.status).toBe(200)

      expect(await response.text()).toContain(route.help)
    })

    test(`POST ${route.path} requires --id`, async () => {
      const response = await app.request(route.path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
    })
  }
})
