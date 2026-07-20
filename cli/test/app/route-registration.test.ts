import { app } from "@/app/index"
import { describe, expect, test } from "bun:test"

/**
 * #100: app/index.ts に未登録だったルートが到達可能（help が返る）ことを確認する。
 * 未登録だと catch-all に落ちて help が返らず、コマンドが実質使用不可になっていた。
 * 動的セグメント (:param?) は省略形でも一致する。help は param 解決前に返るため、
 * 基底パスへの POST + help:1 で全 62 ルートの到達性を検証する。
 */
const previouslyUnregistered: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/1on1/delete", help: "1on1 delete" },
  { path: "/1on1/edit", help: "1on1 edit" },
  { path: "/1on1/mine", help: "1on1 mine" },
  { path: "/1on1/show", help: "1on1 show" },
  { path: "/application/mine", help: "application mine" },
  { path: "/application/show", help: "application show" },
  { path: "/application/update", help: "application update" },
  { path: "/application/withdraw", help: "application withdraw" },
  { path: "/asset/delete", help: "asset delete" },
  { path: "/asset/update", help: "asset update" },
  { path: "/career/application-show", help: "career application-show" },
  { path: "/career/application-update", help: "career application-update" },
  { path: "/career/applications", help: "career applications" },
  { path: "/career/sheet-delete", help: "career sheet-delete" },
  { path: "/career/withdraw", help: "career withdraw" },
  { path: "/employee/delete", help: "employee delete" },
  { path: "/employee/register", help: "employee register" },
  { path: "/employee/timeline", help: "employee timeline" },
  { path: "/employee/state", help: "employee state" },
  { path: "/employee/archive", help: "employee archive" },
  { path: "/personnel-action/request", help: "personnel-action request" },
  { path: "/personnel-action/apply", help: "personnel-action apply" },
  { path: "/personnel-action/correct", help: "personnel-action correct" },
  { path: "/batch/employee-lifecycle/preflight", help: "employee-lifecycle preflight" },
  { path: "/batch/employee-lifecycle/backfill", help: "employee-lifecycle backfill" },
  { path: "/batch/employee-lifecycle/verify", help: "employee-lifecycle verify" },
  {
    path: "/batch/employee-lifecycle/rebuild-projections",
    help: "rebuild-projections",
  },
  { path: "/batch/employee-lifecycle/process-outbox", help: "process-outbox" },
  { path: "/employee/show", help: "employee show" },
  { path: "/employee/update", help: "employee update" },
  { path: "/expense/delete", help: "expense delete" },
  { path: "/expense/update", help: "expense update" },
  { path: "/goal/delete", help: "goal delete" },
  { path: "/goal/mine", help: "goal mine" },
  { path: "/goal/show", help: "goal show" },
  { path: "/goal/update", help: "goal update" },
  { path: "/kb/add", help: "kb add" },
  { path: "/kb/delete", help: "kb delete" },
  { path: "/kb/edit", help: "kb edit" },
  { path: "/leave/cancel", help: "leave cancel" },
  { path: "/leave/show", help: "leave show" },
  { path: "/leave/update", help: "leave update" },
  { path: "/notify/delete", help: "notify delete" },
  { path: "/notify/show", help: "notify show" },
  { path: "/onboarding/assignment/cancel", help: "onboarding assignment cancel" },
  { path: "/onboarding/assignment/show", help: "onboarding assignment show" },
  { path: "/onboarding/assignment/update", help: "onboarding assignment update" },
  {
    path: "/onboarding/template-bind-lifecycle",
    help: "onboarding template-bind-lifecycle",
  },
  {
    path: "/onboarding/template-unbind-lifecycle",
    help: "onboarding template-unbind-lifecycle",
  },
  { path: "/onboarding/uncomplete", help: "onboarding uncomplete" },
  { path: "/org/dept/create", help: "org dept create" },
  { path: "/org/dept/delete", help: "org dept delete" },
  { path: "/org/dept/list", help: "org dept list" },
  { path: "/org/dept/show", help: "org dept show" },
  { path: "/org/dept/update", help: "org dept update" },
  { path: "/shift/assignment-delete", help: "shift assignment-delete" },
  { path: "/shift/assignment-show", help: "shift assignment-show" },
  { path: "/shift/assignment-update", help: "shift assignment-update" },
  { path: "/shift/pattern-delete", help: "shift pattern-delete" },
  { path: "/shift/pattern-show", help: "shift pattern-show" },
  { path: "/shift/pattern-update", help: "shift pattern-update" },
  { path: "/shift/swap-cancel", help: "shift swap-cancel" },
  { path: "/shift/swap-mine", help: "shift swap-mine" },
  { path: "/shift/swap-show", help: "shift swap-show" },
  { path: "/skill/remove", help: "skill remove" },
  { path: "/skill/show", help: "skill show" },
  { path: "/survey/edit", help: "survey edit" },
  { path: "/survey/response", help: "survey response" },
  { path: "/survey/responses", help: "survey responses" },
  { path: "/survey/withdraw", help: "survey withdraw" },
  { path: "/training/cancel", help: "training cancel" },
  { path: "/training/course-archive", help: "training course-archive" },
  { path: "/training/course-update", help: "training course-update" },
  { path: "/training/reschedule", help: "training reschedule" },
  { path: "/training/show", help: "training show" },
]

/** セキュリティ修正で追加されたルートの到達性テスト。 */
const securityRoutes: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/batch/migrate-password-hashes", help: "batch migrate-password-hashes" },
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

describe("route registration (security fixes)", () => {
  for (const route of securityRoutes) {
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
