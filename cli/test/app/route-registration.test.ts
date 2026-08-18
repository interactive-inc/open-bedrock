import { app } from "@/app/index"
import { describe, expect, test } from "bun:test"

/**
 * #100: app/index.ts に未登録だったルートが到達可能（help が返る）ことを確認する。
 * 未登録だと catch-all に落ちて help が返らず、コマンドが実質使用不可になっていた。
 * 動的セグメント (:param?) は省略形でも一致する。help は param 解決前に返るため、
 * 基底パスへの POST + help:1 で全 62 ルートの到達性を検証する。
 */
const previouslyUnregistered: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/one-on-ones/delete", help: "one-on-ones delete" },
  { path: "/one-on-ones/edit", help: "one-on-ones edit" },
  { path: "/one-on-ones/mine", help: "one-on-ones mine" },
  { path: "/one-on-ones/show", help: "one-on-ones show" },
  { path: "/application-requests/mine", help: "application-requests mine" },
  { path: "/application-requests/show", help: "application-requests show" },
  { path: "/application-requests/update", help: "application-requests update" },
  { path: "/application-requests/withdraw", help: "application-requests withdraw" },
  { path: "/assets/delete", help: "assets delete" },
  { path: "/assets/update", help: "assets update" },
  { path: "/career-applications/show", help: "career-applications show" },
  { path: "/career-applications/update", help: "career-applications update" },
  { path: "/career-applications/list", help: "career-applications list" },
  { path: "/career-sheets/delete", help: "career-sheets delete" },
  { path: "/career-applications/withdraw", help: "career-applications withdraw" },
  { path: "/employees/delete", help: "employees delete" },
  { path: "/employees/register", help: "employees register" },
  { path: "/employees/timeline", help: "employees timeline" },
  { path: "/employees/state", help: "employees state" },
  { path: "/employees/archive", help: "employees archive" },
  { path: "/personnel-actions/request", help: "personnel-actions request" },
  { path: "/personnel-actions/apply", help: "personnel-actions apply" },
  { path: "/personnel-actions/correct", help: "personnel-actions correct" },
  { path: "/batch/employee-lifecycle/preflight", help: "employee-lifecycle preflight" },
  { path: "/batch/employee-lifecycle/backfill", help: "employee-lifecycle backfill" },
  { path: "/batch/employee-lifecycle/verify", help: "employee-lifecycle verify" },
  {
    path: "/batch/employee-lifecycle/rebuild-projections",
    help: "rebuild-projections",
  },
  { path: "/batch/employee-lifecycle/process-outbox", help: "process-outbox" },
  { path: "/employees/show", help: "employees show" },
  { path: "/employees/update", help: "employees update" },
  { path: "/expenses/delete", help: "expenses delete" },
  { path: "/expenses/update", help: "expenses update" },
  { path: "/performance-goals/delete", help: "performance-goals delete" },
  { path: "/performance-goals/mine", help: "performance-goals mine" },
  { path: "/performance-goals/show", help: "performance-goals show" },
  { path: "/performance-goals/update", help: "performance-goals update" },
  { path: "/knowledge-articles/add", help: "knowledge-articles add" },
  { path: "/knowledge-articles/delete", help: "knowledge-articles delete" },
  { path: "/knowledge-articles/edit", help: "knowledge-articles edit" },
  { path: "/leave-requests/cancel", help: "leave-requests cancel" },
  { path: "/leave-requests/show", help: "leave-requests show" },
  { path: "/leave-requests/update", help: "leave-requests update" },
  { path: "/notifications/delete", help: "notifications delete" },
  { path: "/notifications/show", help: "notifications show" },
  { path: "/onboarding-assignments/cancel", help: "onboarding-assignments cancel" },
  { path: "/onboarding-assignments/show", help: "onboarding-assignments show" },
  { path: "/onboarding-assignments/update", help: "onboarding-assignments update" },
  {
    path: "/onboarding-templates/bind-lifecycle",
    help: "onboarding-templates bind-lifecycle",
  },
  {
    path: "/onboarding-templates/unbind-lifecycle",
    help: "onboarding-templates unbind-lifecycle",
  },
  { path: "/onboarding-tasks/uncomplete", help: "onboarding-tasks uncomplete" },
  { path: "/departments/create", help: "departments create" },
  { path: "/departments/delete", help: "departments delete" },
  { path: "/departments/list", help: "departments list" },
  { path: "/departments/show", help: "departments show" },
  { path: "/departments/update", help: "departments update" },
  { path: "/shift-assignments/delete", help: "shift-assignments delete" },
  { path: "/shift-assignments/show", help: "shift-assignments show" },
  { path: "/shift-assignments/update", help: "shift-assignments update" },
  { path: "/shift-patterns/delete", help: "shift-patterns delete" },
  { path: "/shift-patterns/show", help: "shift-patterns show" },
  { path: "/shift-patterns/update", help: "shift-patterns update" },
  { path: "/shift-swap-requests/cancel", help: "shift-swap-requests cancel" },
  { path: "/shift-swap-requests/mine", help: "shift-swap-requests mine" },
  { path: "/shift-swap-requests/show", help: "shift-swap-requests show" },
  { path: "/employee-skills/remove", help: "employee-skills remove" },
  { path: "/skill-definitions/show", help: "skill-definitions show" },
  { path: "/surveys/edit", help: "surveys edit" },
  { path: "/surveys/response", help: "surveys response" },
  { path: "/surveys/responses", help: "surveys responses" },
  { path: "/surveys/withdraw", help: "surveys withdraw" },
  { path: "/training-enrollments/cancel", help: "training-enrollments cancel" },
  { path: "/training-courses/archive", help: "training-courses archive" },
  { path: "/training-courses/update", help: "training-courses update" },
  { path: "/training-enrollments/reschedule", help: "training-enrollments reschedule" },
  { path: "/training-enrollments/show", help: "training-enrollments show" },
]

/** evaluation-sheets CLI ルート (#991) の到達性テスト。 */
const evaluationSheetRoutes: ReadonlyArray<{ path: string; help: string }> = [
  { path: "/evaluation-sheets", help: "evaluation-sheets" },
  { path: "/evaluation-sheets/list", help: "evaluation-sheets list" },
  { path: "/evaluation-sheets/mine", help: "evaluation-sheets mine" },
  { path: "/evaluation-sheets/show", help: "evaluation-sheets show" },
  { path: "/evaluation-sheets/create", help: "evaluation-sheets create" },
  { path: "/evaluation-sheets/transition", help: "evaluation-sheets transition" },
  { path: "/evaluation-sheets/evaluators", help: "evaluation-sheets evaluators" },
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

describe("route registration (evaluation-sheets #991)", () => {
  for (const route of evaluationSheetRoutes) {
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
