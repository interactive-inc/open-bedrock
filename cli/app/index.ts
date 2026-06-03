import { HTTPException } from "hono/http-exception"
import { factory } from "@/factory"
import appApproveHandler from "@/app/app/approve/[app_id]/route"
import appHandler from "@/app/app/route"
import appInboxHandler from "@/app/app/inbox/route"
import appMineHandler from "@/app/app/mine/route"
import appRejectHandler from "@/app/app/reject/[app_id]/route"
import appShowHandler from "@/app/app/show/[app_id]/route"
import appSubmitHandler from "@/app/app/submit/[template_code]/route"
import appTemplateHandler from "@/app/app/template/[code]/route"
import appTemplatesHandler from "@/app/app/templates/route"
import assetHandler from "@/app/asset/route"
import assetLendHandler from "@/app/asset/lend/[asset_code]/route"
import assetListHandler from "@/app/asset/list/route"
import assetMineHandler from "@/app/asset/mine/route"
import assetRegisterHandler from "@/app/asset/register/route"
import assetReturnHandler from "@/app/asset/return/[asset_code]/route"
import assetShowHandler from "@/app/asset/show/[asset_code]/route"
import attendanceClockInHandler from "@/app/attendance/clock-in/route"
import attendanceClockOutHandler from "@/app/attendance/clock-out/route"
import attendanceHandler from "@/app/attendance/route"
import attendanceListHandler from "@/app/attendance/list/route"
import attendanceMeHandler from "@/app/attendance/me/route"
import attendanceSummaryHandler from "@/app/attendance/summary/route"
import batchHandler from "@/app/batch/route"
import careerApplyHandler from "@/app/career/apply/[posting_id]/route"
import careerHandler from "@/app/career/route"
import careerPostingsHandler from "@/app/career/postings/route"
import careerSheetHandler from "@/app/career/sheet/route"
import careerSheetUpdateHandler from "@/app/career/sheet-update/route"
import dashboardHandler from "@/app/dashboard/route"
import employeeHandler from "@/app/employee/route"
import employeeSearchHandler from "@/app/employee/search/route"
import expenseApproveHandler from "@/app/expense/approve/[expense_id]/route"
import expenseHandler from "@/app/expense/route"
import expenseInboxHandler from "@/app/expense/inbox/route"
import expenseMineHandler from "@/app/expense/mine/route"
import expenseRejectHandler from "@/app/expense/reject/[expense_id]/route"
import expenseShowHandler from "@/app/expense/show/[expense_id]/route"
import expenseSubmitHandler from "@/app/expense/submit/route"
import goalCreateHandler from "@/app/goal/create/route"
import goalEvaluateHandler from "@/app/goal/evaluate/[goal_id]/route"
import goalHandler from "@/app/goal/route"
import goalListHandler from "@/app/goal/list/route"
import kbGetHandler from "@/app/kb/get/[kid]/route"
import kbHandler from "@/app/kb/route"
import kbSearchHandler from "@/app/kb/search/route"
import leaveApproveHandler from "@/app/leave/approve/[leave_id]/route"
import leaveBalanceHandler from "@/app/leave/balance/route"
import leaveHandler from "@/app/leave/route"
import leaveInboxHandler from "@/app/leave/inbox/route"
import leaveMineHandler from "@/app/leave/mine/route"
import leaveRejectHandler from "@/app/leave/reject/[leave_id]/route"
import leaveRequestHandler from "@/app/leave/request/route"
import loginHandler from "@/app/login/route"
import notifyCountHandler from "@/app/notify/count/route"
import notifyHandler from "@/app/notify/route"
import notifyListHandler from "@/app/notify/list/route"
import notifyReadAllHandler from "@/app/notify/read-all/route"
import notifyReadHandler from "@/app/notify/read/[notification_id]/route"
import notifySendHandler from "@/app/notify/send/route"
import onboardingAssignHandler from "@/app/onboarding/assign/[employee_code]/route"
import onboardingCompleteHandler from "@/app/onboarding/complete/[task_id]/route"
import onboardingHandler from "@/app/onboarding/route"
import onboardingMeHandler from "@/app/onboarding/me/route"
import onboardingShowHandler from "@/app/onboarding/show/[employee_code]/route"
import onboardingTemplatesHandler from "@/app/onboarding/templates/route"
import oneononeCreateHandler from "@/app/1on1/create/route"
import oneononeHandler from "@/app/1on1/route"
import oneononeListHandler from "@/app/1on1/list/route"
import orgHandler from "@/app/org/route"
import orgLineHandler from "@/app/org/line/[employee_code]/route"
import orgMembersHandler from "@/app/org/members/[dept_code]/route"
import orgTreeHandler from "@/app/org/tree/route"
import payrollHandler from "@/app/payroll/route"
import payrollIssueHandler from "@/app/payroll/issue/route"
import payrollReviseHandler from "@/app/payroll/revise/route"
import payrollRevisionHandler from "@/app/payroll/revision/[employee_code]/route"
import payrollSlipHandler from "@/app/payroll/slip/route"
import payrollSlipShowHandler from "@/app/payroll/slip/show/[payslip_id]/route"
import reviewCycleCreateHandler from "@/app/review/cycle/create/route"
import reviewCycleHandler from "@/app/review/cycle/route"
import reviewCyclesHandler from "@/app/review/cycles/route"
import reviewHandler from "@/app/review/route"
import reviewMineHandler from "@/app/review/mine/route"
import reviewResultsHandler from "@/app/review/results/[cycle_id]/[employee_code]/route"
import reviewSubmitHandler from "@/app/review/submit/[form_id]/route"
import roomAvailHandler from "@/app/room/avail/route"
import roomCancelHandler from "@/app/room/cancel/route"
import roomHandler from "@/app/room/route"
import roomMineHandler from "@/app/room/mine/route"
import roomReserveHandler from "@/app/room/reserve/route"
import roomShowHandler from "@/app/room/show/route"
import roomUpdateHandler from "@/app/room/update/route"
import shiftAssignHandler from "@/app/shift/assign/route"
import shiftAssignmentsHandler from "@/app/shift/assignments/route"
import shiftHandler from "@/app/shift/route"
import shiftMineHandler from "@/app/shift/mine/route"
import shiftPatternCreateHandler from "@/app/shift/pattern-create/route"
import shiftPatternsHandler from "@/app/shift/patterns/route"
import shiftPublishHandler from "@/app/shift/publish/[id]/route"
import shiftSwapApproveHandler from "@/app/shift/swap-approve/[id]/route"
import shiftSwapHandler from "@/app/shift/swap/route"
import skillHandler from "@/app/skill/route"
import skillListHandler from "@/app/skill/list/route"
import skillMineHandler from "@/app/skill/mine/route"
import skillSetHandler from "@/app/skill/set/[skill_code]/route"
import surveyAnswerHandler from "@/app/survey/answer/[survey_id]/route"
import surveyHandler from "@/app/survey/route"
import surveyListHandler from "@/app/survey/list/route"
import surveySummaryHandler from "@/app/survey/summary/[survey_id]/route"
import trainingCompleteHandler from "@/app/training/complete/[id]/route"
import trainingCourseHandler from "@/app/training/course/[code]/route"
import trainingCourseCreateHandler from "@/app/training/course-create/route"
import trainingCoursesHandler from "@/app/training/courses/route"
import trainingEnrollHandler from "@/app/training/enroll/route"
import trainingEnrollmentsHandler from "@/app/training/enrollments/route"
import trainingHandler from "@/app/training/route"
import trainingMineHandler from "@/app/training/mine/route"
import whoamiHandler from "@/app/whoami/route"
import businessTripHandler from "@/app/business-trip/route"
import businessTripRequestHandler from "@/app/business-trip/request/route"
import businessTripMineHandler from "@/app/business-trip/mine/route"
import businessTripShowHandler from "@/app/business-trip/show/route"
import businessTripUpdateHandler from "@/app/business-trip/update/route"
import businessTripCancelHandler from "@/app/business-trip/cancel/route"
import rentalHandler from "@/app/rental/route"
import rentalReserveHandler from "@/app/rental/reserve/route"
import rentalMineHandler from "@/app/rental/mine/route"
import rentalShowHandler from "@/app/rental/show/route"
import rentalUpdateHandler from "@/app/rental/update/route"
import rentalCancelHandler from "@/app/rental/cancel/route"

const base = factory.createApp()

base.onError((error, c) => {
  // ハンドラに到達して投げられたエラーであることを示すマーカー。
  // 未登録パスで Hono が返す素の 404 と、ハンドラ由来の 404 を index.ts で区別する。
  c.header("x-karte-handler-error", "1")

  if (error instanceof HTTPException) {
    return c.text(error.message, error.status)
  }

  return c.text(error instanceof Error ? error.message : String(error), 500)
})

// すべて POST で登録する。位置引数は path param、`--flag value` は JSON body。
// ファイル構造（routes/<path>/route.ts、Next.js App Router 記法）に対応する。
const routes = base

routes.post("/login", ...loginHandler)
routes.post("/whoami", ...whoamiHandler)

routes.post("/employee", ...employeeHandler)
routes.post("/employee/search", ...employeeSearchHandler)

routes.post("/app", ...appHandler)
routes.post("/app/templates", ...appTemplatesHandler)
routes.post("/app/template/:code?", ...appTemplateHandler)
routes.post("/app/submit/:template_code?", ...appSubmitHandler)
routes.post("/app/inbox", ...appInboxHandler)
routes.post("/app/mine", ...appMineHandler)
routes.post("/app/show/:app_id?", ...appShowHandler)
routes.post("/app/approve/:app_id?", ...appApproveHandler)
routes.post("/app/reject/:app_id?", ...appRejectHandler)

routes.post("/kb", ...kbHandler)
routes.post("/kb/search", ...kbSearchHandler)
routes.post("/kb/search/:q", ...kbSearchHandler)
routes.post("/kb/get/:kid?", ...kbGetHandler)

routes.post("/room", ...roomHandler)
routes.post("/room/avail", ...roomAvailHandler)
routes.post("/room/reserve", ...roomReserveHandler)
routes.post("/room/mine", ...roomMineHandler)
routes.post("/room/show", ...roomShowHandler)
routes.post("/room/update", ...roomUpdateHandler)
routes.post("/room/cancel", ...roomCancelHandler)

routes.post("/skill", ...skillHandler)
routes.post("/skill/list", ...skillListHandler)
routes.post("/skill/mine", ...skillMineHandler)
routes.post("/skill/set/:skill_code?", ...skillSetHandler)

routes.post("/expense", ...expenseHandler)
routes.post("/expense/submit", ...expenseSubmitHandler)
routes.post("/expense/mine", ...expenseMineHandler)
routes.post("/expense/inbox", ...expenseInboxHandler)
routes.post("/expense/show/:expense_id?", ...expenseShowHandler)
routes.post("/expense/approve/:expense_id?", ...expenseApproveHandler)
routes.post("/expense/reject/:expense_id?", ...expenseRejectHandler)

routes.post("/goal", ...goalHandler)
routes.post("/goal/list", ...goalListHandler)
routes.post("/goal/create", ...goalCreateHandler)
routes.post("/goal/evaluate/:goal_id?", ...goalEvaluateHandler)

routes.post("/1on1", ...oneononeHandler)
routes.post("/1on1/list", ...oneononeListHandler)
routes.post("/1on1/create", ...oneononeCreateHandler)

routes.post("/survey", ...surveyHandler)
routes.post("/survey/list", ...surveyListHandler)
routes.post("/survey/answer/:survey_id?", ...surveyAnswerHandler)
routes.post("/survey/summary/:survey_id?", ...surveySummaryHandler)

routes.post("/career", ...careerHandler)
routes.post("/career/sheet", ...careerSheetHandler)
routes.post("/career/sheet-update", ...careerSheetUpdateHandler)
routes.post("/career/postings", ...careerPostingsHandler)
routes.post("/career/apply/:posting_id?", ...careerApplyHandler)

routes.post("/asset", ...assetHandler)
routes.post("/asset/list", ...assetListHandler)
routes.post("/asset/mine", ...assetMineHandler)
routes.post("/asset/show/:asset_code?", ...assetShowHandler)
routes.post("/asset/register", ...assetRegisterHandler)
routes.post("/asset/lend/:asset_code?", ...assetLendHandler)
routes.post("/asset/return/:asset_code?", ...assetReturnHandler)

routes.post("/notify", ...notifyHandler)
routes.post("/notify/list", ...notifyListHandler)
routes.post("/notify/count", ...notifyCountHandler)
routes.post("/notify/read-all", ...notifyReadAllHandler)
routes.post("/notify/read/:notification_id?", ...notifyReadHandler)
routes.post("/notify/send", ...notifySendHandler)

routes.post("/attendance", ...attendanceHandler)
routes.post("/attendance/clock-in", ...attendanceClockInHandler)
routes.post("/attendance/clock-out", ...attendanceClockOutHandler)
routes.post("/attendance/me", ...attendanceMeHandler)
routes.post("/attendance/summary", ...attendanceSummaryHandler)
routes.post("/attendance/list", ...attendanceListHandler)

routes.post("/leave", ...leaveHandler)
routes.post("/leave/balance", ...leaveBalanceHandler)
routes.post("/leave/request", ...leaveRequestHandler)
routes.post("/leave/mine", ...leaveMineHandler)
routes.post("/leave/inbox", ...leaveInboxHandler)
routes.post("/leave/approve/:leave_id?", ...leaveApproveHandler)
routes.post("/leave/reject/:leave_id?", ...leaveRejectHandler)

routes.post("/org", ...orgHandler)
routes.post("/org/tree", ...orgTreeHandler)
routes.post("/org/members/:dept_code?", ...orgMembersHandler)
routes.post("/org/line/:employee_code?", ...orgLineHandler)

routes.post("/onboarding", ...onboardingHandler)
routes.post("/onboarding/templates", ...onboardingTemplatesHandler)
routes.post("/onboarding/assign/:employee_code?", ...onboardingAssignHandler)
routes.post("/onboarding/me", ...onboardingMeHandler)
routes.post("/onboarding/complete/:task_id?", ...onboardingCompleteHandler)
routes.post("/onboarding/show/:employee_code?", ...onboardingShowHandler)

routes.post("/payroll", ...payrollHandler)
routes.post("/payroll/slip", ...payrollSlipHandler)
routes.post("/payroll/slip/show/:payslip_id?", ...payrollSlipShowHandler)
routes.post("/payroll/issue", ...payrollIssueHandler)
routes.post("/payroll/revision/:employee_code?", ...payrollRevisionHandler)
routes.post("/payroll/revise", ...payrollReviseHandler)

routes.post("/review", ...reviewHandler)
routes.post("/review/cycles", ...reviewCyclesHandler)
routes.post("/review/cycle", ...reviewCycleHandler)
routes.post("/review/cycle/create", ...reviewCycleCreateHandler)
routes.post("/review/mine", ...reviewMineHandler)
routes.post("/review/submit/:form_id?", ...reviewSubmitHandler)
routes.post("/review/results/:cycle_id?/:employee_code?", ...reviewResultsHandler)

routes.post("/training", ...trainingHandler)
routes.post("/training/courses", ...trainingCoursesHandler)
routes.post("/training/course/:code?", ...trainingCourseHandler)
routes.post("/training/course-create", ...trainingCourseCreateHandler)
routes.post("/training/enrollments", ...trainingEnrollmentsHandler)
routes.post("/training/mine", ...trainingMineHandler)
routes.post("/training/enroll", ...trainingEnrollHandler)
routes.post("/training/complete/:id?", ...trainingCompleteHandler)

routes.post("/shift", ...shiftHandler)
routes.post("/shift/assignments", ...shiftAssignmentsHandler)
routes.post("/shift/mine", ...shiftMineHandler)
routes.post("/shift/assign", ...shiftAssignHandler)
routes.post("/shift/publish/:id?", ...shiftPublishHandler)
routes.post("/shift/patterns", ...shiftPatternsHandler)
routes.post("/shift/pattern-create", ...shiftPatternCreateHandler)
routes.post("/shift/swap", ...shiftSwapHandler)
routes.post("/shift/swap-approve/:id?", ...shiftSwapApproveHandler)

routes.post("/batch", ...batchHandler)
routes.post("/dashboard", ...dashboardHandler)
routes.post("/business-trip", ...businessTripHandler)
routes.post("/business-trip/request", ...businessTripRequestHandler)
routes.post("/business-trip/mine", ...businessTripMineHandler)
routes.post("/business-trip/show", ...businessTripShowHandler)
routes.post("/business-trip/update", ...businessTripUpdateHandler)
routes.post("/business-trip/cancel", ...businessTripCancelHandler)
routes.post("/rental", ...rentalHandler)
routes.post("/rental/reserve", ...rentalReserveHandler)
routes.post("/rental/mine", ...rentalMineHandler)
routes.post("/rental/show", ...rentalShowHandler)
routes.post("/rental/update", ...rentalUpdateHandler)
routes.post("/rental/cancel", ...rentalCancelHandler)

export const app = routes
