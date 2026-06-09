import { app } from "@/app/index"
import { describe, expect, test } from "bun:test"

// #100: app/index.ts に未登録だったルートが到達可能（help が返る）ことを確認する。
// 未登録だと catch-all に落ちて help が返らず、コマンドが実質使用不可になっていた。
const previouslyUnregistered: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/employee/register", help: "employee register" },
  { path: "/employee/update/E001", help: "employee update" },
  { path: "/employee/delete/E001", help: "employee delete" },
  { path: "/goal/update", help: "goal update" },
  { path: "/goal/delete", help: "goal delete" },
  { path: "/leave/cancel", help: "leave cancel" },
  { path: "/kb/add", help: "kb add" },
  { path: "/kb/edit", help: "kb edit" },
  { path: "/kb/delete", help: "kb delete" },
  { path: "/1on1/delete", help: "1on1 delete" },
  { path: "/skill/show/SKILL1", help: "skill show" },
  { path: "/org/dept/list", help: "org dept list" },
]

describe("route registration (#100)", () => {
  for (const route of previouslyUnregistered) {
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
