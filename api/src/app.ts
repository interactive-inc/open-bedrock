import { hc } from "hono/client"
import { HTTPException } from "hono/http-exception"
import { bodyLimit } from "hono/body-limit"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { contextStorage } from "hono/context-storage"
import { databaseMiddleware } from "@/interface/shared/database-middleware"
import { rateLimitMiddleware } from "@/interface/shared/rate-limit-middleware"
import { requestContextMiddleware } from "@/interface/shared/request-context-middleware"
import { factory } from "@/lib/factory"
import { auditNoStore } from "@/interface/audit/audit-route-contract"
import * as auditEventExportsRoute from "@/interface/audit/audit-event-exports/route"
import * as auditEventDetailRoute from "@/interface/audit/audit-events/[event_id]/route"
import * as auditEventsRoute from "@/interface/audit/audit-events/route"
import * as applicationAdminRoute from "@/interface/application/applications/admin/route"
import * as applicationApproveRoute from "@/interface/application/applications/[id]/approve/route"
import * as applicationDetailRoute from "@/interface/application/applications/[id]/route"
import * as applicationInboxRoute from "@/interface/application/applications/inbox/route"
import * as applicationWorkflowRepairsRoute from "@/interface/application/applications/workflow-repairs/route"
import * as applicationReassignWorkflowStepRoute from "@/interface/application/applications/[id]/reassign-workflow-step/route"
import * as applicationListRoute from "@/interface/application/applications/route"
import * as applicationRejectRoute from "@/interface/application/applications/[id]/reject/route"
import * as applicationResubmitRoute from "@/interface/application/applications/[id]/resubmit/route"
import * as applicationSubmitRoute from "@/interface/application/applications/submit-route"
import * as applicationTemplateDetailRoute from "@/interface/application/templates/[code]/route"
import * as applicationTemplateWorkflowRoute from "@/interface/application/templates/[code]/workflow/route"
import * as approvalDelegationsRoute from "@/interface/application/approval-delegations/route"
import * as approvalDelegationDetailRoute from "@/interface/application/approval-delegations/[id]/route"
import * as applicationTemplateListRoute from "@/interface/application/templates/route"
import * as assetDetailRoute from "@/interface/asset/[code]/route"
import * as assetDisposeRoute from "@/interface/asset/[code]/dispose/route"
import * as assetHoldingsRoute from "@/interface/asset/holdings/route"
import * as assetLendRoute from "@/interface/asset/[code]/lend/route"
import * as assetLentMeRoute from "@/interface/asset/lent/me/route"
import * as assetListRoute from "@/interface/asset/route"
import * as assetRegisterRoute from "@/interface/asset/register/route"
import * as assetReturnRoute from "@/interface/asset/[code]/return/route"
import * as stocktakeCheckRoute from "@/interface/stocktake/[id]/assets/[code]/check/route"
import * as stocktakeCloseRoute from "@/interface/stocktake/[id]/close/route"
import * as stocktakeDetailRoute from "@/interface/stocktake/[id]/route"
import * as stocktakeListRoute from "@/interface/stocktake/route"
import * as attendanceClockInRoute from "@/interface/attendance/clock-in/route"
import * as attendanceClockOutRoute from "@/interface/attendance/clock-out/route"
import * as attendanceListRoute from "@/interface/attendance/route"
import * as attendanceMeRoute from "@/interface/attendance/me/route"
import * as attendanceMeSummaryRoute from "@/interface/attendance/me/summary/route"
import * as authLoginRoute from "@/interface/auth/login/route"
import * as authLogoutRoute from "@/interface/auth/logout/route"
import * as authMeRoute from "@/interface/auth/me/route"
import * as authRefreshRoute from "@/interface/auth/refresh/route"
import * as batchMigratePasswordHashesRoute from "@/interface/batch/migrate-password-hashes/route"
import * as batchRoute from "@/interface/batch/route"
import * as lifecycleMigrationPreflightRoute from "@/interface/batch/employee-lifecycle/preflight/route"
import * as lifecycleMigrationBackfillRoute from "@/interface/batch/employee-lifecycle/backfill/route"
import * as lifecycleMigrationVerifyRoute from "@/interface/batch/employee-lifecycle/verify/route"
import * as lifecycleProjectionRebuildRoute from "@/interface/batch/employee-lifecycle/rebuild-projections/route"
import * as businessTripCreateRoute from "@/interface/business-trip/business-trips/route"
import * as businessTripDetailRoute from "@/interface/business-trip/business-trips/[id]/route"
import * as businessTripMineRoute from "@/interface/business-trip/business-trips/me/route"
import * as rentalReservationCreateRoute from "@/interface/rental/reservations/route"
import * as rentalReservationDetailRoute from "@/interface/rental/reservations/[id]/route"
import * as rentalReservationMineRoute from "@/interface/rental/reservations/me/route"
import * as careerPostingApplyRoute from "@/interface/career/postings/[posting_id]/apply/route"
import * as careerPostingDetailRoute from "@/interface/career/postings/[posting_id]/route"
import * as careerPostingListRoute from "@/interface/career/postings/route"
import * as careerSheetMeRoute from "@/interface/career/sheet/me/route"
import * as careerSheetMeUpdateRoute from "@/interface/career/sheet/me/update/route"
import * as dashboardRoute from "@/interface/dashboard/route"
import * as inboxCountsRoute from "@/interface/inbox/counts/route"
import * as employeeListRoute from "@/interface/employee/route"
import * as employeeDirectoryRoute from "@/interface/employee/directory/route"
import * as employeeLifecycleEventsRoute from "@/interface/employee/[code]/lifecycle-events/route"
import * as employeeLifecycleStateRoute from "@/interface/employee/[code]/lifecycle-state/route"
import * as employeeArchiveRoute from "@/interface/employee/[code]/archive/route"
import * as lifecycleOutboxRoute from "@/interface/batch/employee-lifecycle/process-outbox/route"
import * as personnelActionsRoute from "@/interface/employee/personnel-actions/route"
import * as personnelActionCorrectionRoute from "@/interface/employee/personnel-actions/[id]/correct/route"
import * as personnelActionRequestsRoute from "@/interface/employee/personnel-action-requests/route"
import * as personnelActionRequestDetailRoute from "@/interface/employee/personnel-action-requests/[id]/route"
import * as expenseAdminRoute from "@/interface/expense/admin/route"
import * as expenseApproveRoute from "@/interface/expense/[id]/approve/route"
import * as expenseCreateRoute from "@/interface/expense/route"
import * as expenseDetailRoute from "@/interface/expense/[id]/route"
import * as expenseInboxRoute from "@/interface/expense/inbox/route"
import * as expenseMeRoute from "@/interface/expense/me/route"
import * as expenseRejectRoute from "@/interface/expense/[id]/reject/route"
import * as budgetListRoute from "@/interface/budget/route"
import * as budgetSummaryRoute from "@/interface/budget/summary/route"
import * as budgetDetailRoute from "@/interface/budget/[id]/route"
import * as goalCreateRoute from "@/interface/goal/goals/create-route"
import * as goalEvaluationCreateRoute from "@/interface/goal/goals/[goal_id]/evaluations/route"
import * as goalListRoute from "@/interface/goal/goals/route"
import * as governanceCapabilitiesRoute from "@/interface/governance/capabilities/route"
import * as governanceDocumentDetailRoute from "@/interface/governance/documents/[code]/route"
import * as governanceDocumentAcknowledgeRoute from "@/interface/governance/documents/[code]/acknowledge/route"
import * as governanceDocumentPublishRoute from "@/interface/governance/documents/[code]/versions/[version]/publish/route"
import * as governanceDocumentReviewRoute from "@/interface/governance/documents/[code]/versions/[version]/review/route"
import * as governanceDocumentSubmitReviewRoute from "@/interface/governance/documents/[code]/versions/[version]/submit-review/route"
import * as governanceDocumentsRoute from "@/interface/governance/documents/route"
import * as governanceDocumentSyncRoute from "@/interface/governance/documents/sync/route"
import * as governanceImpactRoute from "@/interface/governance/impact/route"
import * as governanceOrgRolesRoute from "@/interface/governance/org-roles/route"
import * as governanceOrgRoleAssignmentsRoute from "@/interface/governance/org-roles/[code]/assignments/route"
import * as governanceOrgRoleAssignmentDetailRoute from "@/interface/governance/org-roles/assignments/[id]/route"
import * as knowledgeDetailRoute from "@/interface/knowledge/[id]/route"
import * as knowledgeListRoute from "@/interface/knowledge/route"
import * as leaveBalanceMeRoute from "@/interface/leave/balance/me/route"
import * as leaveRequestAdminRoute from "@/interface/leave/requests/admin/route"
import * as leaveRequestApproveRoute from "@/interface/leave/requests/[id]/approve/route"
import * as leaveRequestCreateRoute from "@/interface/leave/requests/route"
import * as leaveRequestInboxRoute from "@/interface/leave/requests/inbox/route"
import * as leaveRequestMeRoute from "@/interface/leave/requests/me/route"
import * as leaveRequestRejectRoute from "@/interface/leave/requests/[id]/reject/route"
import * as notificationCreateRoute from "@/interface/notification/route"
import * as notificationMeRoute from "@/interface/notification/me/route"
import * as notificationMeUnreadCountRoute from "@/interface/notification/me/unread-count/route"
import * as notificationReadAllRoute from "@/interface/notification/read-all/route"
import * as notificationReadRoute from "@/interface/notification/[id]/read/route"
import * as onboardingAssignRoute from "@/interface/onboarding/assign/route"
import * as onboardingEmployeeRoute from "@/interface/onboarding/employee/[code]/route"
import * as onboardingMeRoute from "@/interface/onboarding/me/route"
import * as onboardingTaskCompleteRoute from "@/interface/onboarding/tasks/[id]/complete/route"
import * as onboardingTemplateListRoute from "@/interface/onboarding/templates/route"
import * as oneOnOneRoute from "@/interface/oneonone/route"
import * as thanksRoute from "@/interface/thanks/route"
import * as thanksBudgetMeRoute from "@/interface/thanks-points/budget/me/route"
import * as thanksBalanceMeRoute from "@/interface/thanks-points/balance/me/route"
import * as thanksRewardsRoute from "@/interface/thanks-points/rewards/route"
import * as thanksRewardDetailRoute from "@/interface/thanks-points/rewards/[id]/route"
import * as thanksRedemptionsRoute from "@/interface/thanks-points/redemptions/route"
import * as thanksRedemptionsAdminRoute from "@/interface/thanks-points/redemptions/admin/route"
import * as thanksRedemptionsMeRoute from "@/interface/thanks-points/redemptions/me/route"
import * as thanksRedemptionsInboxRoute from "@/interface/thanks-points/redemptions/inbox/route"
import * as thanksRedemptionApproveRoute from "@/interface/thanks-points/redemptions/[id]/approve/route"
import * as thanksRedemptionRejectRoute from "@/interface/thanks-points/redemptions/[id]/reject/route"
import * as orgDepartmentMembersRoute from "@/interface/org/departments/[code]/members/route"
import * as orgReportingLineRoute from "@/interface/org/reporting-line/[employee_code]/route"
import * as orgTreeRoute from "@/interface/org/tree/route"
import * as reviewCycleCloseRoute from "@/interface/review/cycles/[cycle_id]/close/route"
import * as reviewCycleCreateRoute from "@/interface/review/cycles-create/route"
import * as reviewCycleListRoute from "@/interface/review/cycles/route"
import * as reviewCycleOpenRoute from "@/interface/review/cycles/[cycle_id]/open/route"
import * as reviewCycleResultsRoute from "@/interface/review/cycles/[cycle_id]/results/[employee_code]/route"
import * as reviewCyclePolicyRoute from "@/interface/review/cycles/[cycle_id]/policy/route"
import * as reviewFormMeRoute from "@/interface/review/forms/me/route"
import * as reviewFormSubmitRoute from "@/interface/review/forms/[form_id]/submit/route"
import * as roomAvailabilityRoute from "@/interface/room/availability/route"
import * as roomReservationCreateRoute from "@/interface/room/reservations/route"
import * as roomReservationDetailRoute from "@/interface/room/reservations/[id]/route"
import * as roomReservationMineRoute from "@/interface/room/reservations/me/route"
import * as shiftAssignmentCreateRoute from "@/interface/shift/assignments/create-route"
import * as shiftAssignmentListRoute from "@/interface/shift/assignments/route"
import * as shiftAssignmentMeRoute from "@/interface/shift/assignments/me/route"
import * as shiftAssignmentPublishRoute from "@/interface/shift/assignments/[id]/publish/route"
import * as shiftPatternCreateRoute from "@/interface/shift/patterns/create-route"
import * as shiftPatternListRoute from "@/interface/shift/patterns/route"
import * as shiftSwapRequestAdminRoute from "@/interface/shift/swap-requests/admin/route"
import * as shiftSwapRequestApproveRoute from "@/interface/shift/swap-requests/[id]/approve/route"
import * as shiftSwapRequestRoute from "@/interface/shift/swap-requests/route"
import * as skillListRoute from "@/interface/skill/skills/route"
import * as skillMeRoute from "@/interface/skill/skills/me/route"
import * as skillMeUpdateRoute from "@/interface/skill/skills/me/update/route"
import * as surveyListRoute from "@/interface/survey/surveys/route"
import * as surveyResponseCreateRoute from "@/interface/survey/surveys/[survey_id]/responses/route"
import * as surveySummaryRoute from "@/interface/survey/surveys/[survey_id]/summary/route"
import * as trainingCourseCreateRoute from "@/interface/training/courses/create-route"
import * as trainingCourseDetailRoute from "@/interface/training/courses/[code]/route"
import * as trainingCourseListRoute from "@/interface/training/courses/route"
import * as trainingEnrollmentCompleteRoute from "@/interface/training/enrollments/[id]/complete/route"
import * as trainingEnrollmentCreateRoute from "@/interface/training/enrollments/enroll-route"
import * as trainingEnrollmentListRoute from "@/interface/training/enrollments/route"
import * as trainingEnrollmentMeRoute from "@/interface/training/enrollments/me/route"
import * as applicationApplicationsMeRoute from "@/interface/application/applications/me/route"
import * as careerApplicationsIdRoute from "@/interface/career/applications/[id]/route"
import * as careerApplicationsMeRoute from "@/interface/career/applications/me/route"
import * as employeeCodeRoute from "@/interface/employee/[code]/route"
import * as goalGoalsGoalIdRoute from "@/interface/goal/goals/[goal_id]/route"
import * as goalGoalsMeRoute from "@/interface/goal/goals/me/route"
import * as leaveRequestsIdRoute from "@/interface/leave/requests/[id]/route"
import * as notificationIdRoute from "@/interface/notification/[id]/route"
import * as onboardingAssignmentsIdRoute from "@/interface/onboarding/assignments/[id]/route"
import * as onboardingTasksIdUncompleteRoute from "@/interface/onboarding/tasks/[id]/uncomplete/route"
import * as oneononeIdRoute from "@/interface/oneonone/[id]/route"
import * as oneononeMeRoute from "@/interface/oneonone/me/route"
import * as orgDepartmentsCodeRoute from "@/interface/org/departments/[code]/route"
import * as orgDepartmentsRoute from "@/interface/org/departments/route"
import * as shiftAssignmentsIdRoute from "@/interface/shift/assignments/[id]/route"
import * as shiftPatternsIdRoute from "@/interface/shift/patterns/[id]/route"
import * as shiftSwapRequestsIdRoute from "@/interface/shift/swap-requests/[id]/route"
import * as shiftSwapRequestsMeRoute from "@/interface/shift/swap-requests/me/route"
import * as skillSkillsMeSkillCodeRoute from "@/interface/skill/skills/me/[skill_code]/route"
import * as surveySurveysResponsesResponseIdRoute from "@/interface/survey/surveys/responses/[response_id]/route"
import * as surveySurveysResponsesMeRoute from "@/interface/survey/surveys/responses/me/route"
import * as trainingEnrollmentsIdRoute from "@/interface/training/enrollments/[id]/route"
import * as resignationCreateRoute from "@/interface/resignation/resignations/route"
import * as resignationDetailRoute from "@/interface/resignation/resignations/[id]/route"
import * as resignationMineRoute from "@/interface/resignation/resignations/me/route"
import * as lifeEventCreateRoute from "@/interface/life-event/life-events/route"
import * as lifeEventDetailRoute from "@/interface/life-event/life-events/[id]/route"
import * as lifeEventMineRoute from "@/interface/life-event/life-events/me/route"
import * as familyCareLeaveCreateRoute from "@/interface/family-care-leave/family-care-leaves/route"
import * as familyCareLeaveDetailRoute from "@/interface/family-care-leave/family-care-leaves/[id]/route"
import * as familyCareLeaveMineRoute from "@/interface/family-care-leave/family-care-leaves/me/route"
import * as certificateRequestCreateRoute from "@/interface/certificate-request/certificate-requests/route"
import * as certificateRequestDetailRoute from "@/interface/certificate-request/certificate-requests/[id]/route"
import * as certificateRequestMineRoute from "@/interface/certificate-request/certificate-requests/me/route"
import * as antisocialCheckCreateRoute from "@/interface/antisocial-check/antisocial-checks/route"
import * as antisocialCheckDetailRoute from "@/interface/antisocial-check/antisocial-checks/[id]/route"
import * as antisocialCheckMineRoute from "@/interface/antisocial-check/antisocial-checks/me/route"
import * as antisocialCheckAdminRoute from "@/interface/antisocial-check/antisocial-checks/admin/route"
import * as applicationTemplateCreateRoute from "@/interface/application/templates/create-route"
import * as roomMasterListRoute from "@/interface/room/rooms/route"
import * as roomMasterDetailRoute from "@/interface/room/rooms/[id]/route"
import * as surveyCreateRoute from "@/interface/survey/surveys/create-route"
import * as surveyDetailRoute from "@/interface/survey/surveys/[survey_id]/route"
import * as onboardingTemplateDetailRoute from "@/interface/onboarding/templates/[code]/route"
import * as onboardingLifecycleBindingRoute from "@/interface/onboarding/templates/[code]/lifecycle-binding/route"
import * as iamRolesRoute from "@/interface/iam/roles/route"
import * as iamPermissionsRoute from "@/interface/iam/permissions/route"
import * as iamAccountsRoute from "@/interface/iam/accounts/route"
import * as iamAccountRolesRoute from "@/interface/iam/accounts/[id]/roles/route"
import * as iamRoleDetailRoute from "@/interface/iam/roles/[id]/route"
import * as iamAccountStatusRoute from "@/interface/iam/accounts/[id]/status/route"
import * as iamAccountRoleRevokeRoute from "@/interface/iam/accounts/[id]/roles/[roleKey]/route"
import * as iamAccountResetPasswordRoute from "@/interface/iam/accounts/[id]/reset-password/route"
import * as reviewCycleEditRoute from "@/interface/review/cycles/[cycle_id]/route"

// CORS_ORIGIN 未設定時に許可するローカル開発用 Origin。
const defaultAllowedOrigins = ["http://localhost:3000", "http://localhost:5173"]

let corsWarningLogged = false

// Origin リクエストヘッダを env.CORS_ORIGIN（カンマ区切り）と照合し、許可された Origin のみ返す。
// 未設定時は defaultAllowedOrigins のみ許可し、セキュリティ警告をログに出す。
// 本番では必ず CORS_ORIGIN を設定すること。
function resolveAllowedOrigin(origin: string, allowList: string | undefined): string | null {
  if (allowList === undefined || allowList.trim() === "") {
    if (!corsWarningLogged) {
      corsWarningLogged = true
      console.warn(
        "[SECURITY] CORS_ORIGIN is not set — falling back to localhost origins. " +
          "Set CORS_ORIGIN in production to restrict cross-origin access.",
      )
    }
    return defaultAllowedOrigins.includes(origin) ? origin : null
  }

  const allowed = allowList
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  return allowed.includes(origin) ? origin : null
}

let nowProductionGuardWarned = false
const nowProductionGuardMiddleware = factory.createMiddleware(async (c, next) => {
  if (!nowProductionGuardWarned && c.env.CORS_ORIGIN !== undefined && c.env.NOW !== undefined) {
    nowProductionGuardWarned = true
    console.warn("[SECURITY] NOW override is set in production — this affects all timestamps")
  }
  await next()
})

const globalBodyLimit = bodyLimit({ maxSize: 1_000_000 })

const globalBodyLimitExceptAuditExport = factory.createMiddleware(async (c, next) => {
  if (c.req.path === "/audit-event-exports") {
    await next()
    return
  }

  await globalBodyLimit(c, next)
})

// interface/ のファイル構造（Next.js App Router 記法）を Hono のメソッドチェーンに対応づける。
// 動的セグメント [code] は :code として登録する。RPC（hc）のため必ずチェーンで繋ぐ。
export const app = factory
  .createApp()
  .use("*", requestContextMiddleware)
  .use("*", auditNoStore)
  .use(
    "*",
    cors({
      origin: (origin, c) => resolveAllowedOrigin(origin, c.env.CORS_ORIGIN),
      exposeHeaders: ["X-Request-ID", "Content-Disposition"],
    }),
  )
  .use("*", globalBodyLimitExceptAuditExport)
  .use("*", rateLimitMiddleware)
  // nosniff / HSTS / X-Frame-Options 等のセキュリティヘッダを付与する。
  // COOP/CORP は別オリジンの正規クライアント（web/cli）からの利用を阻害しうるため無効化する
  // （クロスオリジンアクセスの制御は CORS が担う）。
  .use("*", secureHeaders({ crossOriginResourcePolicy: false, crossOriginOpenerPolicy: false }))
  .use("*", contextStorage())
  .use("*", nowProductionGuardMiddleware)
  .use("*", databaseMiddleware)
  .onError((error, c) => {
    if (error instanceof HTTPException) {
      // toHttpException 経由の例外は res に {error, code} の JSON を積んでいる。
      // それを尊重して返し、CLI/AI が理由（message）と code を受け取れるようにする。
      // res 未設定の素の HTTPException（401/413/429 等）は従来どおり {error: message} を返す。
      if (error.res) {
        return error.getResponse()
      }

      return c.json({ error: error.message }, error.status)
    }

    console.error("[unhandled error]", error)

    return c.json({ error: "internal server error" }, 500)
  })
  .get("/health", (c) => c.json({ status: "ok" }, 200))
  .post("/auth/login", ...authLoginRoute.POST)
  .post("/auth/logout", ...authLogoutRoute.POST)
  .post("/auth/refresh", ...authRefreshRoute.POST)
  .get("/me", ...authMeRoute.GET)
  .get("/audit-events", ...auditEventsRoute.GET)
  .get("/audit-events/:event_id", ...auditEventDetailRoute.GET)
  .post("/audit-event-exports", ...auditEventExportsRoute.POST)
  .get("/employees", ...employeeListRoute.GET)
  .get("/directory/employees", ...employeeDirectoryRoute.GET)
  .get("/employees/:code/lifecycle-events", ...employeeLifecycleEventsRoute.GET)
  .get("/employees/:code/lifecycle-state", ...employeeLifecycleStateRoute.GET)
  .post("/employees/:code/archive", ...employeeArchiveRoute.POST)
  .post("/batch/employee-lifecycle/process-outbox", ...lifecycleOutboxRoute.POST)
  .get("/roles", ...iamRolesRoute.GET)
  .post("/roles", ...iamRolesRoute.POST)
  .get("/permissions", ...iamPermissionsRoute.GET)
  .get("/roles/:id", ...iamRoleDetailRoute.GET)
  .patch("/roles/:id", ...iamRoleDetailRoute.PATCH)
  .delete("/roles/:id", ...iamRoleDetailRoute.DELETE)
  .get("/accounts", ...iamAccountsRoute.GET)
  .post("/accounts/:id/roles", ...iamAccountRolesRoute.POST)
  .delete("/accounts/:id/roles/:roleKey", ...iamAccountRoleRevokeRoute.DELETE)
  .post("/accounts/:id/status", ...iamAccountStatusRoute.POST)
  .post("/accounts/:id/reset-password", ...iamAccountResetPasswordRoute.POST)
  .get("/dashboard", ...dashboardRoute.GET)
  .get("/inbox/counts", ...inboxCountsRoute.GET)
  .get("/batch", ...batchRoute.GET)
  .post("/batch/migrate-password-hashes", ...batchMigratePasswordHashesRoute.POST)
  .post("/batch/employee-lifecycle/preflight", ...lifecycleMigrationPreflightRoute.POST)
  .post("/batch/employee-lifecycle/backfill", ...lifecycleMigrationBackfillRoute.POST)
  .post("/batch/employee-lifecycle/verify", ...lifecycleMigrationVerifyRoute.POST)
  .post("/batch/employee-lifecycle/rebuild-projections", ...lifecycleProjectionRebuildRoute.POST)
  .get("/org/tree", ...orgTreeRoute.GET)
  .get("/org/departments/:code/members", ...orgDepartmentMembersRoute.GET)
  .get("/org/reporting-line/:employee_code", ...orgReportingLineRoute.GET)
  .get("/goals", ...goalListRoute.GET)
  .post("/goals", ...goalCreateRoute.POST)
  .post("/goals/:goal_id/evaluations", ...goalEvaluationCreateRoute.POST)
  .get("/governance/documents", ...governanceDocumentsRoute.GET)
  .post("/governance/documents/sync", ...governanceDocumentSyncRoute.POST)
  .get("/governance/documents/:code", ...governanceDocumentDetailRoute.GET)
  .post("/governance/documents/:code/acknowledge", ...governanceDocumentAcknowledgeRoute.POST)
  .post(
    "/governance/documents/:code/versions/:version/submit-review",
    ...governanceDocumentSubmitReviewRoute.POST,
  )
  .post(
    "/governance/documents/:code/versions/:version/review",
    ...governanceDocumentReviewRoute.POST,
  )
  .post(
    "/governance/documents/:code/versions/:version/publish",
    ...governanceDocumentPublishRoute.POST,
  )
  .get("/governance/impact", ...governanceImpactRoute.GET)
  .get("/governance/capabilities", ...governanceCapabilitiesRoute.GET)
  .get("/governance/org-roles", ...governanceOrgRolesRoute.GET)
  .post("/governance/org-roles/:code/assignments", ...governanceOrgRoleAssignmentsRoute.POST)
  .delete("/governance/org-roles/assignments/:id", ...governanceOrgRoleAssignmentDetailRoute.DELETE)
  .get("/applications/admin", ...applicationAdminRoute.GET)
  .get("/applications/inbox", ...applicationInboxRoute.GET)
  .get("/applications/workflow-repairs", ...applicationWorkflowRepairsRoute.GET)
  .get("/applications/me", ...applicationApplicationsMeRoute.GET)
  .get("/applications/:id", ...applicationDetailRoute.GET)
  .get("/applications", ...applicationListRoute.GET)
  .post("/applications", ...applicationSubmitRoute.POST)
  .post("/applications/:id/approve", ...applicationApproveRoute.POST)
  .post("/applications/:id/reject", ...applicationRejectRoute.POST)
  .post("/applications/:id/resubmit", ...applicationResubmitRoute.POST)
  .post("/applications/:id/reassign-workflow-step", ...applicationReassignWorkflowStepRoute.POST)
  .get("/application-templates/:code", ...applicationTemplateDetailRoute.GET)
  .get("/application-templates/:code/workflow", ...applicationTemplateWorkflowRoute.GET)
  .put("/application-templates/:code/workflow", ...applicationTemplateWorkflowRoute.PUT)
  .get("/approval-delegations", ...approvalDelegationsRoute.GET)
  .post("/approval-delegations", ...approvalDelegationsRoute.POST)
  .delete("/approval-delegations/:id", ...approvalDelegationDetailRoute.DELETE)
  .get("/application-templates", ...applicationTemplateListRoute.GET)
  .get("/knowledge/:id", ...knowledgeDetailRoute.GET)
  .get("/knowledge", ...knowledgeListRoute.GET)
  .get("/rooms/availability", ...roomAvailabilityRoute.GET)
  .post("/rooms/reservations", ...roomReservationCreateRoute.POST)
  .get("/rooms/reservations/me", ...roomReservationMineRoute.GET)
  .get("/rooms/reservations/:id", ...roomReservationDetailRoute.GET)
  .put("/rooms/reservations/:id", ...roomReservationDetailRoute.PUT)
  .delete("/rooms/reservations/:id", ...roomReservationDetailRoute.DELETE)
  .get("/skills/me", ...skillMeRoute.GET)
  .put("/skills/me", ...skillMeUpdateRoute.PUT)
  .get("/skills", ...skillListRoute.GET)
  .get("/oneonones", ...oneOnOneRoute.GET)
  .post("/oneonones", ...oneOnOneRoute.POST)
  .get("/thanks", ...thanksRoute.GET)
  .post("/thanks", ...thanksRoute.POST)
  .get("/thanks/budget/me", ...thanksBudgetMeRoute.GET)
  .get("/thanks/balance/me", ...thanksBalanceMeRoute.GET)
  .get("/thanks/rewards", ...thanksRewardsRoute.GET)
  .post("/thanks/rewards", ...thanksRewardsRoute.POST)
  .patch("/thanks/rewards/:id", ...thanksRewardDetailRoute.PATCH)
  .get("/thanks/redemptions/admin", ...thanksRedemptionsAdminRoute.GET)
  .get("/thanks/redemptions/me", ...thanksRedemptionsMeRoute.GET)
  .get("/thanks/redemptions/inbox", ...thanksRedemptionsInboxRoute.GET)
  .post("/thanks/redemptions", ...thanksRedemptionsRoute.POST)
  .post("/thanks/redemptions/:id/approve", ...thanksRedemptionApproveRoute.POST)
  .post("/thanks/redemptions/:id/reject", ...thanksRedemptionRejectRoute.POST)
  .get("/surveys/:survey_id/summary", ...surveySummaryRoute.GET)
  .post("/surveys/:survey_id/responses", ...surveyResponseCreateRoute.POST)
  .get("/surveys", ...surveyListRoute.GET)
  .get("/surveys/:survey_id", ...surveyDetailRoute.GET)
  .get("/career/postings", ...careerPostingListRoute.GET)
  .post("/career/postings", ...careerPostingListRoute.POST)
  .post("/career/postings/:posting_id/apply", ...careerPostingApplyRoute.POST)
  .get("/career/postings/:posting_id", ...careerPostingDetailRoute.GET)
  .put("/career/postings/:posting_id", ...careerPostingDetailRoute.PUT)
  .delete("/career/postings/:posting_id", ...careerPostingDetailRoute.DELETE)
  .get("/career/sheet/me", ...careerSheetMeRoute.GET)
  .put("/career/sheet/me", ...careerSheetMeUpdateRoute.PUT)
  .get("/assets/lent/me", ...assetLentMeRoute.GET)
  .get("/assets/holdings", ...assetHoldingsRoute.GET)
  .post("/assets/:code/lend", ...assetLendRoute.POST)
  .post("/assets/:code/return", ...assetReturnRoute.POST)
  .post("/assets/:code/dispose", ...assetDisposeRoute.POST)
  .get("/assets/:code", ...assetDetailRoute.GET)
  .post("/assets", ...assetRegisterRoute.POST)
  .get("/assets", ...assetListRoute.GET)
  .post("/stocktakes/:id/assets/:code/check", ...stocktakeCheckRoute.POST)
  .post("/stocktakes/:id/close", ...stocktakeCloseRoute.POST)
  .get("/stocktakes/:id", ...stocktakeDetailRoute.GET)
  .get("/stocktakes", ...stocktakeListRoute.GET)
  .post("/stocktakes", ...stocktakeListRoute.POST)
  .post("/attendance/clock-in", ...attendanceClockInRoute.POST)
  .post("/attendance/clock-out", ...attendanceClockOutRoute.POST)
  .get("/attendance/me/summary", ...attendanceMeSummaryRoute.GET)
  .get("/attendance/me", ...attendanceMeRoute.GET)
  .get("/attendance", ...attendanceListRoute.GET)
  .get("/leave/balance/me", ...leaveBalanceMeRoute.GET)
  .get("/leave/requests/admin", ...leaveRequestAdminRoute.GET)
  .get("/leave/requests/inbox", ...leaveRequestInboxRoute.GET)
  .get("/leave/requests/me", ...leaveRequestMeRoute.GET)
  .post("/leave/requests/:id/approve", ...leaveRequestApproveRoute.POST)
  .post("/leave/requests/:id/reject", ...leaveRequestRejectRoute.POST)
  .post("/leave/requests", ...leaveRequestCreateRoute.POST)
  .get("/onboarding/employee/:code", ...onboardingEmployeeRoute.GET)
  .get("/onboarding/me", ...onboardingMeRoute.GET)
  .get("/onboarding/templates", ...onboardingTemplateListRoute.GET)
  .post("/onboarding/assign", ...onboardingAssignRoute.POST)
  .post("/onboarding/tasks/:id/complete", ...onboardingTaskCompleteRoute.POST)
  .get("/expenses/admin", ...expenseAdminRoute.GET)
  .get("/expenses/inbox", ...expenseInboxRoute.GET)
  .get("/expenses/me", ...expenseMeRoute.GET)
  .get("/expenses/:id", ...expenseDetailRoute.GET)
  .post("/expenses/:id/approve", ...expenseApproveRoute.POST)
  .post("/expenses/:id/reject", ...expenseRejectRoute.POST)
  .post("/expenses", ...expenseCreateRoute.POST)
  .get("/budgets/summary", ...budgetSummaryRoute.GET)
  .get("/budgets/:id", ...budgetDetailRoute.GET)
  .get("/budgets", ...budgetListRoute.GET)
  .post("/budgets", ...budgetListRoute.POST)
  .get("/training/courses/:code", ...trainingCourseDetailRoute.GET)
  .get("/training/courses", ...trainingCourseListRoute.GET)
  .post("/training/courses", ...trainingCourseCreateRoute.POST)
  .get("/training/enrollments/me", ...trainingEnrollmentMeRoute.GET)
  .post("/training/enrollments/:id/complete", ...trainingEnrollmentCompleteRoute.POST)
  .get("/training/enrollments", ...trainingEnrollmentListRoute.GET)
  .post("/training/enrollments", ...trainingEnrollmentCreateRoute.POST)
  .get("/notifications/me/unread-count", ...notificationMeUnreadCountRoute.GET)
  .get("/notifications/me", ...notificationMeRoute.GET)
  .post("/notifications/:id/read", ...notificationReadRoute.POST)
  .post("/notifications/read-all", ...notificationReadAllRoute.POST)
  .post("/notifications", ...notificationCreateRoute.POST)
  .get("/shift/assignments/me", ...shiftAssignmentMeRoute.GET)
  .get("/shift/assignments", ...shiftAssignmentListRoute.GET)
  .post("/shift/assignments", ...shiftAssignmentCreateRoute.POST)
  .post("/shift/assignments/:id/publish", ...shiftAssignmentPublishRoute.POST)
  .get("/shift/patterns", ...shiftPatternListRoute.GET)
  .post("/shift/patterns", ...shiftPatternCreateRoute.POST)
  .post("/shift/swap-requests/:id/approve", ...shiftSwapRequestApproveRoute.POST)
  .get("/shift/swap-requests/admin", ...shiftSwapRequestAdminRoute.GET)
  .get("/shift/swap-requests", ...shiftSwapRequestRoute.GET)
  .post("/shift/swap-requests", ...shiftSwapRequestRoute.POST)
  .post("/review-cycles", ...reviewCycleCreateRoute.POST)
  .get("/review-cycles", ...reviewCycleListRoute.GET)
  .post("/review-cycles/:cycle_id/close", ...reviewCycleCloseRoute.POST)
  .post("/review-cycles/:cycle_id/open", ...reviewCycleOpenRoute.POST)
  .get("/review-cycles/:cycle_id/results/:employee_code", ...reviewCycleResultsRoute.GET)
  .get("/review-cycles/:cycle_id/policy", ...reviewCyclePolicyRoute.GET)
  .put("/review-cycles/:cycle_id/policy", ...reviewCyclePolicyRoute.PUT)
  .post("/review-forms/:form_id/submit", ...reviewFormSubmitRoute.POST)
  .get("/review-forms/me", ...reviewFormMeRoute.GET)
  .put("/applications/:id", ...applicationDetailRoute.PUT)
  .delete("/applications/:id", ...applicationDetailRoute.DELETE)
  .get("/career/applications/me", ...careerApplicationsMeRoute.GET)
  .get("/career/applications/:id", ...careerApplicationsIdRoute.GET)
  .put("/career/applications/:id", ...careerApplicationsIdRoute.PUT)
  .delete("/career/applications/:id", ...careerApplicationsIdRoute.DELETE)
  .delete("/career/sheet/me", ...careerSheetMeRoute.DELETE)
  .post("/employees", ...employeeListRoute.POST)
  .post("/personnel-actions", ...personnelActionsRoute.POST)
  .post("/personnel-actions/:id/correct", ...personnelActionCorrectionRoute.POST)
  .post("/personnel-action-requests", ...personnelActionRequestsRoute.POST)
  .get("/personnel-action-requests", ...personnelActionRequestsRoute.GET)
  .get("/personnel-action-requests/:id", ...personnelActionRequestDetailRoute.GET)
  .delete("/personnel-action-requests/:id", ...personnelActionRequestDetailRoute.DELETE)
  .get("/employees/:code", ...employeeCodeRoute.GET)
  .put("/employees/:code", ...employeeCodeRoute.PUT)
  .delete("/employees/:code", ...employeeCodeRoute.DELETE)
  .get("/goals/me", ...goalGoalsMeRoute.GET)
  .get("/goals/:goal_id", ...goalGoalsGoalIdRoute.GET)
  .put("/goals/:goal_id", ...goalGoalsGoalIdRoute.PUT)
  .delete("/goals/:goal_id", ...goalGoalsGoalIdRoute.DELETE)
  .get("/leave/requests/:id", ...leaveRequestsIdRoute.GET)
  .put("/leave/requests/:id", ...leaveRequestsIdRoute.PUT)
  .delete("/leave/requests/:id", ...leaveRequestsIdRoute.DELETE)
  .get("/notifications/:id", ...notificationIdRoute.GET)
  .delete("/notifications/:id", ...notificationIdRoute.DELETE)
  .get("/onboarding/assignments/:id", ...onboardingAssignmentsIdRoute.GET)
  .put("/onboarding/assignments/:id", ...onboardingAssignmentsIdRoute.PUT)
  .delete("/onboarding/assignments/:id", ...onboardingAssignmentsIdRoute.DELETE)
  .post("/onboarding/tasks/:id/uncomplete", ...onboardingTasksIdUncompleteRoute.POST)
  .get("/oneonones/me", ...oneononeMeRoute.GET)
  .get("/oneonones/:id", ...oneononeIdRoute.GET)
  .put("/oneonones/:id", ...oneononeIdRoute.PUT)
  .delete("/oneonones/:id", ...oneononeIdRoute.DELETE)
  .get("/org/departments", ...orgDepartmentsRoute.GET)
  .post("/org/departments", ...orgDepartmentsRoute.POST)
  .get("/org/departments/:code", ...orgDepartmentsCodeRoute.GET)
  .put("/org/departments/:code", ...orgDepartmentsCodeRoute.PUT)
  .delete("/org/departments/:code", ...orgDepartmentsCodeRoute.DELETE)
  .get("/shift/assignments/:id", ...shiftAssignmentsIdRoute.GET)
  .put("/shift/assignments/:id", ...shiftAssignmentsIdRoute.PUT)
  .delete("/shift/assignments/:id", ...shiftAssignmentsIdRoute.DELETE)
  .get("/shift/patterns/:id", ...shiftPatternsIdRoute.GET)
  .put("/shift/patterns/:id", ...shiftPatternsIdRoute.PUT)
  .delete("/shift/patterns/:id", ...shiftPatternsIdRoute.DELETE)
  .get("/shift/swap-requests/me", ...shiftSwapRequestsMeRoute.GET)
  .get("/shift/swap-requests/:id", ...shiftSwapRequestsIdRoute.GET)
  .delete("/shift/swap-requests/:id", ...shiftSwapRequestsIdRoute.DELETE)
  .get("/skills/me/:skill_code", ...skillSkillsMeSkillCodeRoute.GET)
  .delete("/skills/me/:skill_code", ...skillSkillsMeSkillCodeRoute.DELETE)
  .get("/surveys/responses/me", ...surveySurveysResponsesMeRoute.GET)
  .get("/surveys/responses/:response_id", ...surveySurveysResponsesResponseIdRoute.GET)
  .put("/surveys/responses/:response_id", ...surveySurveysResponsesResponseIdRoute.PUT)
  .delete("/surveys/responses/:response_id", ...surveySurveysResponsesResponseIdRoute.DELETE)
  .get("/training/enrollments/:id", ...trainingEnrollmentsIdRoute.GET)
  .put("/training/enrollments/:id", ...trainingEnrollmentsIdRoute.PUT)
  .delete("/training/enrollments/:id", ...trainingEnrollmentsIdRoute.DELETE)
  .post("/knowledge", ...knowledgeListRoute.POST)
  .put("/knowledge/:id", ...knowledgeDetailRoute.PUT)
  .delete("/knowledge/:id", ...knowledgeDetailRoute.DELETE)
  .put("/assets/:code", ...assetDetailRoute.PUT)
  .delete("/assets/:code", ...assetDetailRoute.DELETE)
  .put("/expenses/:id", ...expenseDetailRoute.PUT)
  .delete("/expenses/:id", ...expenseDetailRoute.DELETE)
  .patch("/budgets/:id", ...budgetDetailRoute.PATCH)
  .delete("/budgets/:id", ...budgetDetailRoute.DELETE)
  .put("/training/courses/:code", ...trainingCourseDetailRoute.PUT)
  .delete("/training/courses/:code", ...trainingCourseDetailRoute.DELETE)
  .post("/business-trips", ...businessTripCreateRoute.POST)
  .get("/business-trips/me", ...businessTripMineRoute.GET)
  .get("/business-trips/:id", ...businessTripDetailRoute.GET)
  .put("/business-trips/:id", ...businessTripDetailRoute.PUT)
  .delete("/business-trips/:id", ...businessTripDetailRoute.DELETE)
  .post("/rentals", ...rentalReservationCreateRoute.POST)
  .get("/rentals/me", ...rentalReservationMineRoute.GET)
  .get("/rentals/:id", ...rentalReservationDetailRoute.GET)
  .put("/rentals/:id", ...rentalReservationDetailRoute.PUT)
  .delete("/rentals/:id", ...rentalReservationDetailRoute.DELETE)
  .post("/resignations", ...resignationCreateRoute.POST)
  .get("/resignations/me", ...resignationMineRoute.GET)
  .get("/resignations/:id", ...resignationDetailRoute.GET)
  .put("/resignations/:id", ...resignationDetailRoute.PUT)
  .delete("/resignations/:id", ...resignationDetailRoute.DELETE)
  .post("/life-events", ...lifeEventCreateRoute.POST)
  .get("/life-events/me", ...lifeEventMineRoute.GET)
  .get("/life-events/:id", ...lifeEventDetailRoute.GET)
  .put("/life-events/:id", ...lifeEventDetailRoute.PUT)
  .delete("/life-events/:id", ...lifeEventDetailRoute.DELETE)
  .post("/family-care-leaves", ...familyCareLeaveCreateRoute.POST)
  .get("/family-care-leaves/me", ...familyCareLeaveMineRoute.GET)
  .get("/family-care-leaves/:id", ...familyCareLeaveDetailRoute.GET)
  .put("/family-care-leaves/:id", ...familyCareLeaveDetailRoute.PUT)
  .delete("/family-care-leaves/:id", ...familyCareLeaveDetailRoute.DELETE)
  .post("/certificate-requests", ...certificateRequestCreateRoute.POST)
  .get("/certificate-requests/me", ...certificateRequestMineRoute.GET)
  .get("/certificate-requests/:id", ...certificateRequestDetailRoute.GET)
  .put("/certificate-requests/:id", ...certificateRequestDetailRoute.PUT)
  .delete("/certificate-requests/:id", ...certificateRequestDetailRoute.DELETE)
  .post("/antisocial-checks", ...antisocialCheckCreateRoute.POST)
  .get("/antisocial-checks/me", ...antisocialCheckMineRoute.GET)
  .get("/antisocial-checks/admin", ...antisocialCheckAdminRoute.GET)
  .get("/antisocial-checks/:id", ...antisocialCheckDetailRoute.GET)
  .put("/antisocial-checks/:id", ...antisocialCheckDetailRoute.PUT)
  .delete("/antisocial-checks/:id", ...antisocialCheckDetailRoute.DELETE)
  .post("/application-templates", ...applicationTemplateCreateRoute.POST)
  .put("/application-templates/:code", ...applicationTemplateDetailRoute.PUT)
  .delete("/application-templates/:code", ...applicationTemplateDetailRoute.DELETE)
  .get("/rooms", ...roomMasterListRoute.GET)
  .post("/rooms", ...roomMasterListRoute.POST)
  .get("/rooms/:id", ...roomMasterDetailRoute.GET)
  .put("/rooms/:id", ...roomMasterDetailRoute.PUT)
  .delete("/rooms/:id", ...roomMasterDetailRoute.DELETE)
  .post("/surveys", ...surveyCreateRoute.POST)
  .put("/surveys/:survey_id", ...surveyDetailRoute.PUT)
  .delete("/surveys/:survey_id", ...surveyDetailRoute.DELETE)
  .post("/onboarding/templates", ...onboardingTemplateListRoute.POST)
  .get("/onboarding/templates/:code", ...onboardingTemplateDetailRoute.GET)
  .put("/onboarding/templates/:code", ...onboardingTemplateDetailRoute.PUT)
  .delete("/onboarding/templates/:code", ...onboardingTemplateDetailRoute.DELETE)
  .put("/onboarding/templates/:code/lifecycle-binding", ...onboardingLifecycleBindingRoute.PUT)
  .delete(
    "/onboarding/templates/:code/lifecycle-binding",
    ...onboardingLifecycleBindingRoute.DELETE,
  )
  .put("/review-cycles/:cycle_id", ...reviewCycleEditRoute.PUT)
  .delete("/review-cycles/:cycle_id", ...reviewCycleEditRoute.DELETE)

export type AppType = typeof app

// hc の型計算を api 側（型解決できる環境）で済ませた Client 型。
// web/cli はこの型と AppType を type-only で import し、自前の hc<AppType>() に渡す。
// 実行時に app 本体（全ルート）を消費側のバンドルへ引き込まないよう、ファクトリは置かない。
export type ApiClient = ReturnType<typeof hc<AppType>>
