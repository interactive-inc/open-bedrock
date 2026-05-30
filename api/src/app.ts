import { hc } from "hono/client"
import { HTTPException } from "hono/http-exception"
import { cors } from "hono/cors"
import { contextStorage } from "hono/context-storage"
import { databaseMiddleware } from "@/interface/shared/database-middleware"
import { factory } from "@/lib/factory"
import * as applicationApproveRoute from "@/interface/application/applications/[id]/approve/route"
import * as applicationDetailRoute from "@/interface/application/applications/[id]/route"
import * as applicationInboxRoute from "@/interface/application/applications/inbox/route"
import * as applicationListRoute from "@/interface/application/applications/route"
import * as applicationRejectRoute from "@/interface/application/applications/[id]/reject/route"
import * as applicationSubmitRoute from "@/interface/application/applications/submit-route"
import * as applicationTemplateDetailRoute from "@/interface/application/templates/[code]/route"
import * as applicationTemplateListRoute from "@/interface/application/templates/route"
import * as assetDetailRoute from "@/interface/asset/[code]/route"
import * as assetLendRoute from "@/interface/asset/[code]/lend/route"
import * as assetLentMeRoute from "@/interface/asset/lent/me/route"
import * as assetListRoute from "@/interface/asset/route"
import * as assetRegisterRoute from "@/interface/asset/register/route"
import * as assetReturnRoute from "@/interface/asset/[code]/return/route"
import * as attendanceClockInRoute from "@/interface/attendance/clock-in/route"
import * as attendanceClockOutRoute from "@/interface/attendance/clock-out/route"
import * as attendanceListRoute from "@/interface/attendance/route"
import * as attendanceMeRoute from "@/interface/attendance/me/route"
import * as attendanceMeSummaryRoute from "@/interface/attendance/me/summary/route"
import * as authLoginRoute from "@/interface/auth/login/route"
import * as authMeRoute from "@/interface/auth/me/route"
import * as batchRoute from "@/interface/batch/route"
import * as careerPostingApplyRoute from "@/interface/career/postings/[posting_id]/apply/route"
import * as careerPostingListRoute from "@/interface/career/postings/route"
import * as careerSheetMeRoute from "@/interface/career/sheet/me/route"
import * as careerSheetMeUpdateRoute from "@/interface/career/sheet/me/update/route"
import * as dashboardRoute from "@/interface/dashboard/route"
import * as employeeListRoute from "@/interface/employee/route"
import * as expenseApproveRoute from "@/interface/expense/[id]/approve/route"
import * as expenseCreateRoute from "@/interface/expense/route"
import * as expenseDetailRoute from "@/interface/expense/[id]/route"
import * as expenseInboxRoute from "@/interface/expense/inbox/route"
import * as expenseMeRoute from "@/interface/expense/me/route"
import * as expenseRejectRoute from "@/interface/expense/[id]/reject/route"
import * as goalCreateRoute from "@/interface/goal/goals/create-route"
import * as goalEvaluationCreateRoute from "@/interface/goal/goals/[goal_id]/evaluations/route"
import * as goalListRoute from "@/interface/goal/goals/route"
import * as knowledgeDetailRoute from "@/interface/knowledge/[id]/route"
import * as knowledgeListRoute from "@/interface/knowledge/route"
import * as leaveBalanceMeRoute from "@/interface/leave/balance/me/route"
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
import * as orgDepartmentMembersRoute from "@/interface/org/departments/[code]/members/route"
import * as orgReportingLineRoute from "@/interface/org/reporting-line/[employee_code]/route"
import * as orgTreeRoute from "@/interface/org/tree/route"
import * as payrollPayslipCreateRoute from "@/interface/payroll/payslips/route"
import * as payrollPayslipDetailRoute from "@/interface/payroll/payslips/[id]/route"
import * as payrollPayslipMeRoute from "@/interface/payroll/payslips/me/route"
import * as payrollSalaryRevisionByEmployeeRoute from "@/interface/payroll/salary-revisions/[employee_code]/route"
import * as payrollSalaryRevisionCreateRoute from "@/interface/payroll/salary-revisions/route"
import * as reviewCycleCloseRoute from "@/interface/review/cycles/[cycle_id]/close/route"
import * as reviewCycleCreateRoute from "@/interface/review/cycles-create/route"
import * as reviewCycleListRoute from "@/interface/review/cycles/route"
import * as reviewCycleOpenRoute from "@/interface/review/cycles/[cycle_id]/open/route"
import * as reviewCycleResultsRoute from "@/interface/review/cycles/[cycle_id]/results/[employee_code]/route"
import * as reviewFormMeRoute from "@/interface/review/forms/me/route"
import * as reviewFormSubmitRoute from "@/interface/review/forms/[form_id]/submit/route"
import * as roomAvailabilityRoute from "@/interface/room/availability/route"
import * as roomReservationCreateRoute from "@/interface/room/reservations/route"
import * as shiftAssignmentCreateRoute from "@/interface/shift/assignments/create-route"
import * as shiftAssignmentListRoute from "@/interface/shift/assignments/route"
import * as shiftAssignmentMeRoute from "@/interface/shift/assignments/me/route"
import * as shiftAssignmentPublishRoute from "@/interface/shift/assignments/[id]/publish/route"
import * as shiftPatternCreateRoute from "@/interface/shift/patterns/create-route"
import * as shiftPatternListRoute from "@/interface/shift/patterns/route"
import * as shiftSwapRequestApproveRoute from "@/interface/shift/swap-requests/[id]/approve/route"
import * as shiftSwapRequestCreateRoute from "@/interface/shift/swap-requests/route"
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

// interface/ のファイル構造（Next.js App Router 記法）を Hono のメソッドチェーンに対応づける。
// 動的セグメント [code] は :code として登録する。RPC（hc）のため必ずチェーンで繋ぐ。
export const app = factory
  .createApp()
  .use("*", cors())
  .use("*", contextStorage())
  .use("*", databaseMiddleware)
  .onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status)
    }

    return c.json({ error: "internal server error" }, 500)
  })
  .get("/health", (c) => c.json({ status: "ok" }, 200))
  .post("/auth/login", ...authLoginRoute.POST)
  .get("/me", ...authMeRoute.GET)
  .get("/employees", ...employeeListRoute.GET)
  .get("/dashboard", ...dashboardRoute.GET)
  .get("/batch", ...batchRoute.GET)
  .get("/org/tree", ...orgTreeRoute.GET)
  .get("/org/departments/:code/members", ...orgDepartmentMembersRoute.GET)
  .get("/org/reporting-line/:employee_code", ...orgReportingLineRoute.GET)
  .get("/goals", ...goalListRoute.GET)
  .post("/goals", ...goalCreateRoute.POST)
  .post("/goals/:goal_id/evaluations", ...goalEvaluationCreateRoute.POST)
  .get("/applications/inbox", ...applicationInboxRoute.GET)
  .get("/applications/:id", ...applicationDetailRoute.GET)
  .get("/applications", ...applicationListRoute.GET)
  .post("/applications", ...applicationSubmitRoute.POST)
  .post("/applications/:id/approve", ...applicationApproveRoute.POST)
  .post("/applications/:id/reject", ...applicationRejectRoute.POST)
  .get("/templates/:code", ...applicationTemplateDetailRoute.GET)
  .get("/templates", ...applicationTemplateListRoute.GET)
  .get("/knowledge/:id", ...knowledgeDetailRoute.GET)
  .get("/knowledge", ...knowledgeListRoute.GET)
  .get("/rooms/availability", ...roomAvailabilityRoute.GET)
  .post("/rooms/reservations", ...roomReservationCreateRoute.POST)
  .get("/skills/me", ...skillMeRoute.GET)
  .put("/skills/me", ...skillMeUpdateRoute.PUT)
  .get("/skills", ...skillListRoute.GET)
  .get("/oneonone", ...oneOnOneRoute.GET)
  .post("/oneonone", ...oneOnOneRoute.POST)
  .get("/surveys/:survey_id/summary", ...surveySummaryRoute.GET)
  .post("/surveys/:survey_id/responses", ...surveyResponseCreateRoute.POST)
  .get("/surveys", ...surveyListRoute.GET)
  .get("/career/postings", ...careerPostingListRoute.GET)
  .post("/career/postings/:posting_id/apply", ...careerPostingApplyRoute.POST)
  .get("/career/sheet/me", ...careerSheetMeRoute.GET)
  .put("/career/sheet/me", ...careerSheetMeUpdateRoute.PUT)
  .get("/assets/lent/me", ...assetLentMeRoute.GET)
  .post("/assets/:code/lend", ...assetLendRoute.POST)
  .post("/assets/:code/return", ...assetReturnRoute.POST)
  .get("/assets/:code", ...assetDetailRoute.GET)
  .post("/assets", ...assetRegisterRoute.POST)
  .get("/assets", ...assetListRoute.GET)
  .post("/attendance/clock-in", ...attendanceClockInRoute.POST)
  .post("/attendance/clock-out", ...attendanceClockOutRoute.POST)
  .get("/attendance/me/summary", ...attendanceMeSummaryRoute.GET)
  .get("/attendance/me", ...attendanceMeRoute.GET)
  .get("/attendance", ...attendanceListRoute.GET)
  .get("/leave/balance/me", ...leaveBalanceMeRoute.GET)
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
  .get("/expenses/inbox", ...expenseInboxRoute.GET)
  .get("/expenses/me", ...expenseMeRoute.GET)
  .get("/expenses/:id", ...expenseDetailRoute.GET)
  .post("/expenses/:id/approve", ...expenseApproveRoute.POST)
  .post("/expenses/:id/reject", ...expenseRejectRoute.POST)
  .post("/expenses", ...expenseCreateRoute.POST)
  .get("/payslips/me", ...payrollPayslipMeRoute.GET)
  .get("/payslips/:id", ...payrollPayslipDetailRoute.GET)
  .post("/payslips", ...payrollPayslipCreateRoute.POST)
  .get("/salary-revisions/:employee_code", ...payrollSalaryRevisionByEmployeeRoute.GET)
  .post("/salary-revisions", ...payrollSalaryRevisionCreateRoute.POST)
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
  .post("/shift/swap-requests", ...shiftSwapRequestCreateRoute.POST)
  .post("/review-cycles", ...reviewCycleCreateRoute.POST)
  .get("/review-cycles", ...reviewCycleListRoute.GET)
  .post("/review-cycles/:cycle_id/close", ...reviewCycleCloseRoute.POST)
  .post("/review-cycles/:cycle_id/open", ...reviewCycleOpenRoute.POST)
  .get("/review-cycles/:cycle_id/results/:employee_code", ...reviewCycleResultsRoute.GET)
  .post("/review-forms/:form_id/submit", ...reviewFormSubmitRoute.POST)
  .get("/review-forms/me", ...reviewFormMeRoute.GET)

export type AppType = typeof app

// hc の型計算を api 側（型解決できる環境）で済ませた Client 型。
// web/cli はこれを使うと、HonoBase の schema 抽出が正しく効きレスポンス型が推論される。
export type ApiClient = ReturnType<typeof hc<AppType>>
