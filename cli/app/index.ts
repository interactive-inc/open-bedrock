import { HTTPException } from "hono/http-exception"
import { factory } from "@/factory"
import { loadConfig } from "@/lib/config/config"
import { toConnectionErrorMessage } from "@/lib/http/to-connection-error-message"
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
import batchMigratePasswordHashesHandler from "@/app/batch/migrate-password-hashes/route"
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
import gradesHandler from "@/app/grades/route"
import gradesListHandler from "@/app/grades/list/route"
import gradesCreateHandler from "@/app/grades/create/route"
import gradesUpdateHandler from "@/app/grades/update/route"
import gradesDeleteHandler from "@/app/grades/delete/route"
import gradesAssignmentsHandler from "@/app/grades/assignments/route"
import gradesAssignHandler from "@/app/grades/assign/route"
import employeeEventsHandler from "@/app/employee-events/route"
import employeeEventsListHandler from "@/app/employee-events/list/route"
import employeeEventsRecordHandler from "@/app/employee-events/record/route"
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
import rolesHandler from "@/app/roles/route"
import accountsHandler from "@/app/accounts/route"
import auditLogsHandler from "@/app/audit-logs/route"
import onboardingShowHandler from "@/app/onboarding/show/[employee_code]/route"
import onboardingTemplatesHandler from "@/app/onboarding/templates/route"
import oneononeCreateHandler from "@/app/1on1/create/route"
import oneononeHandler from "@/app/1on1/route"
import oneononeListHandler from "@/app/1on1/list/route"
import thanksHandler from "@/app/thanks/route"
import thanksListHandler from "@/app/thanks/list/route"
import thanksSendHandler from "@/app/thanks/send/route"
import thanksBudgetHandler from "@/app/thanks/budget/route"
import thanksBalanceHandler from "@/app/thanks/balance/route"
import thanksRewardsHandler from "@/app/thanks/rewards/route"
import thanksRewardAddHandler from "@/app/thanks/reward-add/route"
import thanksRedeemHandler from "@/app/thanks/redeem/route"
import thanksRedemptionsHandler from "@/app/thanks/redemptions/route"
import thanksRedemptionApproveHandler from "@/app/thanks/redemption-approve/[redemption_id]/route"
import thanksRedemptionRejectHandler from "@/app/thanks/redemption-reject/[redemption_id]/route"
import orgHandler from "@/app/org/route"
import orgLineHandler from "@/app/org/line/[employee_code]/route"
import orgMembersHandler from "@/app/org/members/[dept_code]/route"
import orgTreeHandler from "@/app/org/tree/route"
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
import businessTripAdminHandler from "@/app/business-trip/admin/route"
import businessTripShowHandler from "@/app/business-trip/show/route"
import businessTripUpdateHandler from "@/app/business-trip/update/route"
import businessTripCancelHandler from "@/app/business-trip/cancel/route"
import businessTripApproveHandler from "@/app/business-trip/approve/route"
import businessTripRejectHandler from "@/app/business-trip/reject/route"
import rentalHandler from "@/app/rental/route"
import rentalReserveHandler from "@/app/rental/reserve/route"
import rentalMineHandler from "@/app/rental/mine/route"
import rentalAdminHandler from "@/app/rental/admin/route"
import rentalShowHandler from "@/app/rental/show/route"
import rentalUpdateHandler from "@/app/rental/update/route"
import rentalCancelHandler from "@/app/rental/cancel/route"
import rentalLendHandler from "@/app/rental/lend/route"
import rentalReturnHandler from "@/app/rental/return/route"
import resignationHandler from "@/app/resignation/route"
import resignationRequestHandler from "@/app/resignation/request/route"
import resignationMineHandler from "@/app/resignation/mine/route"
import resignationAdminHandler from "@/app/resignation/admin/route"
import resignationShowHandler from "@/app/resignation/show/route"
import resignationUpdateHandler from "@/app/resignation/update/route"
import resignationCancelHandler from "@/app/resignation/cancel/route"
import resignationAcceptHandler from "@/app/resignation/accept/route"
import resignationRejectHandler from "@/app/resignation/reject/route"
import lifeEventHandler from "@/app/life-event/route"
import lifeEventRequestHandler from "@/app/life-event/request/route"
import lifeEventMineHandler from "@/app/life-event/mine/route"
import lifeEventAdminHandler from "@/app/life-event/admin/route"
import lifeEventShowHandler from "@/app/life-event/show/route"
import lifeEventUpdateHandler from "@/app/life-event/update/route"
import lifeEventCancelHandler from "@/app/life-event/cancel/route"
import lifeEventApproveHandler from "@/app/life-event/approve/route"
import lifeEventRejectHandler from "@/app/life-event/reject/route"
import familyCareLeaveHandler from "@/app/family-care-leave/route"
import familyCareLeaveRequestHandler from "@/app/family-care-leave/request/route"
import familyCareLeaveMineHandler from "@/app/family-care-leave/mine/route"
import familyCareLeaveAdminHandler from "@/app/family-care-leave/admin/route"
import familyCareLeaveShowHandler from "@/app/family-care-leave/show/route"
import familyCareLeaveUpdateHandler from "@/app/family-care-leave/update/route"
import familyCareLeaveCancelHandler from "@/app/family-care-leave/cancel/route"
import familyCareLeaveApproveHandler from "@/app/family-care-leave/approve/route"
import familyCareLeaveCancelApprovalHandler from "@/app/family-care-leave/cancel-approval/route"
import certificateRequestHandler from "@/app/certificate-request/route"
import certificateRequestRequestHandler from "@/app/certificate-request/request/route"
import certificateRequestMineHandler from "@/app/certificate-request/mine/route"
import certificateRequestAdminHandler from "@/app/certificate-request/admin/route"
import certificateRequestShowHandler from "@/app/certificate-request/show/route"
import certificateRequestUpdateHandler from "@/app/certificate-request/update/route"
import certificateRequestCancelHandler from "@/app/certificate-request/cancel/route"
import certificateRequestIssueHandler from "@/app/certificate-request/issue/route"
import certificateRequestRejectHandler from "@/app/certificate-request/reject/route"
import antisocialCheckHandler from "@/app/antisocial-check/route"
import antisocialCheckRequestHandler from "@/app/antisocial-check/request/route"
import antisocialCheckMineHandler from "@/app/antisocial-check/mine/route"
import antisocialCheckShowHandler from "@/app/antisocial-check/show/route"
import antisocialCheckUpdateHandler from "@/app/antisocial-check/update/route"
import antisocialCheckCancelHandler from "@/app/antisocial-check/cancel/route"
import appTemplateCreateHandler from "@/app/app/template-create/route"
import appTemplateUpdateHandler from "@/app/app/template-update/route"
import appTemplateDeleteHandler from "@/app/app/template-delete/route"
import roomsListHandler from "@/app/rooms/list/route"
import roomsShowHandler from "@/app/rooms/show/[room_id]/route"
import roomsCreateHandler from "@/app/rooms/create/route"
import roomsUpdateHandler from "@/app/rooms/update/[room_id]/route"
import roomsDeleteHandler from "@/app/rooms/delete/[room_id]/route"
import surveyCreateHandler from "@/app/survey/create/route"
import surveyUpdateHandler from "@/app/survey/survey-update/[survey_id]/route"
import surveyDeleteHandler from "@/app/survey/survey-delete/[survey_id]/route"
import careerPostingShowHandler from "@/app/career/posting/[posting_id]/route"
import careerPostingCreateHandler from "@/app/career/posting-create/route"
import careerPostingUpdateHandler from "@/app/career/posting-update/route"
import careerPostingDeleteHandler from "@/app/career/posting-delete/route"
import onboardingTemplateCreateHandler from "@/app/onboarding/template-create/route"
import onboardingTemplateUpdateHandler from "@/app/onboarding/template-update/route"
import onboardingTemplateDeleteHandler from "@/app/onboarding/template-delete/route"
import onboardingTemplateShowHandler from "@/app/onboarding/template/[code]/route"
import reviewCycleUpdateHandler from "@/app/review/cycle/update/route"
import reviewCycleDeleteHandler from "@/app/review/cycle/delete/route"
import reviewCycleOpenHandler from "@/app/review/cycle/open/route"
import reviewCycleCloseHandler from "@/app/review/cycle/close/route"
import cmd1on1DeleteHandler from "@/app/1on1/delete/route"
import cmd1on1EditHandler from "@/app/1on1/edit/route"
import cmd1on1MineHandler from "@/app/1on1/mine/route"
import cmd1on1ShowHandler from "@/app/1on1/show/route"
import applicationMineHandler from "@/app/application/mine/route"
import applicationShowHandler from "@/app/application/show/route"
import applicationUpdateHandler from "@/app/application/update/route"
import applicationWithdrawHandler from "@/app/application/withdraw/route"
import assetDeleteHandler from "@/app/asset/delete/[asset_code]/route"
import assetUpdateHandler from "@/app/asset/update/[asset_code]/route"
import careerApplicationShowHandler from "@/app/career/application-show/route"
import careerApplicationUpdateHandler from "@/app/career/application-update/route"
import careerApplicationsHandler from "@/app/career/applications/route"
import careerSheetDeleteHandler from "@/app/career/sheet-delete/route"
import careerWithdrawHandler from "@/app/career/withdraw/route"
import employeeDeleteHandler from "@/app/employee/delete/[employee_code]/route"
import employeeRegisterHandler from "@/app/employee/register/route"
import employeeShowHandler from "@/app/employee/show/[employee_code]/route"
import employeeUpdateHandler from "@/app/employee/update/[employee_code]/route"
import expenseDeleteHandler from "@/app/expense/delete/[expense_id]/route"
import expenseUpdateHandler from "@/app/expense/update/[expense_id]/route"
import goalDeleteHandler from "@/app/goal/delete/route"
import goalMineHandler from "@/app/goal/mine/route"
import goalShowHandler from "@/app/goal/show/route"
import goalUpdateHandler from "@/app/goal/update/route"
import kbAddHandler from "@/app/kb/add/route"
import kbDeleteHandler from "@/app/kb/delete/route"
import kbEditHandler from "@/app/kb/edit/route"
import leaveCancelHandler from "@/app/leave/cancel/route"
import leaveShowHandler from "@/app/leave/show/route"
import leaveUpdateHandler from "@/app/leave/update/route"
import notifyDeleteHandler from "@/app/notify/delete/route"
import notifyShowHandler from "@/app/notify/show/route"
import onboardingAssignmentCancelHandler from "@/app/onboarding/assignment/cancel/[assignment_id]/route"
import onboardingAssignmentShowHandler from "@/app/onboarding/assignment/show/[assignment_id]/route"
import onboardingAssignmentUpdateHandler from "@/app/onboarding/assignment/update/[assignment_id]/route"
import onboardingUncompleteHandler from "@/app/onboarding/uncomplete/[task_id]/route"
import orgDeptCreateHandler from "@/app/org/dept/create/route"
import orgDeptDeleteHandler from "@/app/org/dept/delete/route"
import orgDeptListHandler from "@/app/org/dept/list/route"
import orgDeptShowHandler from "@/app/org/dept/show/route"
import orgDeptUpdateHandler from "@/app/org/dept/update/route"
import shiftAssignmentDeleteHandler from "@/app/shift/assignment-delete/route"
import shiftAssignmentShowHandler from "@/app/shift/assignment-show/route"
import shiftAssignmentUpdateHandler from "@/app/shift/assignment-update/route"
import shiftPatternDeleteHandler from "@/app/shift/pattern-delete/route"
import shiftPatternShowHandler from "@/app/shift/pattern-show/route"
import shiftPatternUpdateHandler from "@/app/shift/pattern-update/route"
import shiftSwapCancelHandler from "@/app/shift/swap-cancel/route"
import shiftSwapMineHandler from "@/app/shift/swap-mine/route"
import shiftSwapShowHandler from "@/app/shift/swap-show/route"
import skillRemoveHandler from "@/app/skill/remove/[skill_code]/route"
import skillShowHandler from "@/app/skill/show/[skill_code]/route"
import surveyEditHandler from "@/app/survey/edit/[response_id]/route"
import surveyResponseHandler from "@/app/survey/response/[response_id]/route"
import surveyResponsesHandler from "@/app/survey/responses/route"
import surveyWithdrawHandler from "@/app/survey/withdraw/[response_id]/route"
import trainingCancelHandler from "@/app/training/cancel/route"
import trainingCourseArchiveHandler from "@/app/training/course-archive/route"
import trainingCourseUpdateHandler from "@/app/training/course-update/route"
import trainingRescheduleHandler from "@/app/training/reschedule/route"
import trainingShowHandler from "@/app/training/show/route"

const base = factory.createApp()

base.onError(async (error, c) => {
  // ハンドラに到達して投げられたエラーであることを示すマーカー。
  // 未登録パスで Hono が返す素の 404 と、ハンドラ由来の 404 を index.ts で区別する。
  c.header("x-karte-handler-error", "1")

  if (error instanceof HTTPException) {
    if (error.status === 401) {
      return c.text(
        `${error.message}\n認証されていません。'karte login' でログインしてください。`,
        error.status,
      )
    }

    if (error.status === 403) {
      return c.text(`${error.message}\nこの操作を実行する権限がありません。`, error.status)
    }

    return c.text(error.message, error.status)
  }

  // HTTPException でない = API への接続失敗・タイムアウトなど。接続先を添えて案内する。
  const config = await loadConfig()

  const connectionMessage = toConnectionErrorMessage(error, config.base_url)

  if (connectionMessage !== null) {
    return c.text(connectionMessage, 500)
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

routes.post("/grades", ...gradesHandler)
routes.post("/grades/list", ...gradesListHandler)
routes.post("/grades/create", ...gradesCreateHandler)
routes.post("/grades/update", ...gradesUpdateHandler)
routes.post("/grades/delete", ...gradesDeleteHandler)
routes.post("/grades/assignments", ...gradesAssignmentsHandler)
routes.post("/grades/assign", ...gradesAssignHandler)

routes.post("/employee-events", ...employeeEventsHandler)
routes.post("/employee-events/list", ...employeeEventsListHandler)
routes.post("/employee-events/record", ...employeeEventsRecordHandler)

routes.post("/1on1", ...oneononeHandler)
routes.post("/1on1/list", ...oneononeListHandler)
routes.post("/1on1/create", ...oneononeCreateHandler)

routes.post("/thanks", ...thanksHandler)
routes.post("/thanks/list", ...thanksListHandler)
routes.post("/thanks/send", ...thanksSendHandler)
routes.post("/thanks/budget", ...thanksBudgetHandler)
routes.post("/thanks/balance", ...thanksBalanceHandler)
routes.post("/thanks/rewards", ...thanksRewardsHandler)
routes.post("/thanks/reward-add", ...thanksRewardAddHandler)
routes.post("/thanks/redeem", ...thanksRedeemHandler)
routes.post("/thanks/redemptions", ...thanksRedemptionsHandler)
routes.post("/thanks/redemption-approve/:redemption_id?", ...thanksRedemptionApproveHandler)
routes.post("/thanks/redemption-reject/:redemption_id?", ...thanksRedemptionRejectHandler)

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
routes.post("/roles", ...rolesHandler)
routes.post("/accounts", ...accountsHandler)
routes.post("/audit-logs", ...auditLogsHandler)
routes.post("/onboarding/complete/:task_id?", ...onboardingCompleteHandler)
routes.post("/onboarding/show/:employee_code?", ...onboardingShowHandler)

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
routes.post("/batch/migrate-password-hashes", ...batchMigratePasswordHashesHandler)
routes.post("/dashboard", ...dashboardHandler)
routes.post("/business-trip", ...businessTripHandler)
routes.post("/business-trip/request", ...businessTripRequestHandler)
routes.post("/business-trip/mine", ...businessTripMineHandler)
routes.post("/business-trip/admin", ...businessTripAdminHandler)
routes.post("/business-trip/show", ...businessTripShowHandler)
routes.post("/business-trip/update", ...businessTripUpdateHandler)
routes.post("/business-trip/cancel", ...businessTripCancelHandler)
routes.post("/business-trip/approve", ...businessTripApproveHandler)
routes.post("/business-trip/reject", ...businessTripRejectHandler)
routes.post("/rental", ...rentalHandler)
routes.post("/rental/reserve", ...rentalReserveHandler)
routes.post("/rental/mine", ...rentalMineHandler)
routes.post("/rental/admin", ...rentalAdminHandler)
routes.post("/rental/show", ...rentalShowHandler)
routes.post("/rental/update", ...rentalUpdateHandler)
routes.post("/rental/cancel", ...rentalCancelHandler)
routes.post("/rental/lend", ...rentalLendHandler)
routes.post("/rental/return", ...rentalReturnHandler)
routes.post("/resignation", ...resignationHandler)
routes.post("/resignation/request", ...resignationRequestHandler)
routes.post("/resignation/mine", ...resignationMineHandler)
routes.post("/resignation/admin", ...resignationAdminHandler)
routes.post("/resignation/show", ...resignationShowHandler)
routes.post("/resignation/update", ...resignationUpdateHandler)
routes.post("/resignation/cancel", ...resignationCancelHandler)
routes.post("/resignation/accept", ...resignationAcceptHandler)
routes.post("/resignation/reject", ...resignationRejectHandler)
routes.post("/life-event", ...lifeEventHandler)
routes.post("/life-event/request", ...lifeEventRequestHandler)
routes.post("/life-event/mine", ...lifeEventMineHandler)
routes.post("/life-event/admin", ...lifeEventAdminHandler)
routes.post("/life-event/show", ...lifeEventShowHandler)
routes.post("/life-event/update", ...lifeEventUpdateHandler)
routes.post("/life-event/cancel", ...lifeEventCancelHandler)
routes.post("/life-event/approve", ...lifeEventApproveHandler)
routes.post("/life-event/reject", ...lifeEventRejectHandler)
routes.post("/family-care-leave", ...familyCareLeaveHandler)
routes.post("/family-care-leave/request", ...familyCareLeaveRequestHandler)
routes.post("/family-care-leave/mine", ...familyCareLeaveMineHandler)
routes.post("/family-care-leave/admin", ...familyCareLeaveAdminHandler)
routes.post("/family-care-leave/show", ...familyCareLeaveShowHandler)
routes.post("/family-care-leave/update", ...familyCareLeaveUpdateHandler)
routes.post("/family-care-leave/cancel", ...familyCareLeaveCancelHandler)
routes.post("/family-care-leave/approve", ...familyCareLeaveApproveHandler)
routes.post("/family-care-leave/cancel-approval", ...familyCareLeaveCancelApprovalHandler)
routes.post("/certificate-request", ...certificateRequestHandler)
routes.post("/certificate-request/request", ...certificateRequestRequestHandler)
routes.post("/certificate-request/mine", ...certificateRequestMineHandler)
routes.post("/certificate-request/admin", ...certificateRequestAdminHandler)
routes.post("/certificate-request/show", ...certificateRequestShowHandler)
routes.post("/certificate-request/update", ...certificateRequestUpdateHandler)
routes.post("/certificate-request/cancel", ...certificateRequestCancelHandler)
routes.post("/certificate-request/issue", ...certificateRequestIssueHandler)
routes.post("/certificate-request/reject", ...certificateRequestRejectHandler)
routes.post("/antisocial-check", ...antisocialCheckHandler)
routes.post("/antisocial-check/request", ...antisocialCheckRequestHandler)
routes.post("/antisocial-check/mine", ...antisocialCheckMineHandler)
routes.post("/antisocial-check/show", ...antisocialCheckShowHandler)
routes.post("/antisocial-check/update", ...antisocialCheckUpdateHandler)
routes.post("/antisocial-check/cancel", ...antisocialCheckCancelHandler)
routes.post("/app/template-create", ...appTemplateCreateHandler)
routes.post("/app/template-update", ...appTemplateUpdateHandler)
routes.post("/app/template-delete", ...appTemplateDeleteHandler)
routes.post("/rooms/list", ...roomsListHandler)
routes.post("/rooms/create", ...roomsCreateHandler)
routes.post("/rooms/show/:room_id?", ...roomsShowHandler)
routes.post("/rooms/update/:room_id?", ...roomsUpdateHandler)
routes.post("/rooms/delete/:room_id?", ...roomsDeleteHandler)
routes.post("/survey/create", ...surveyCreateHandler)
routes.post("/survey/survey-update/:survey_id?", ...surveyUpdateHandler)
routes.post("/survey/survey-delete/:survey_id?", ...surveyDeleteHandler)
routes.post("/career/posting-create", ...careerPostingCreateHandler)
routes.post("/career/posting-update", ...careerPostingUpdateHandler)
routes.post("/career/posting-delete", ...careerPostingDeleteHandler)
routes.post("/career/posting/:posting_id?", ...careerPostingShowHandler)
routes.post("/onboarding/template-create", ...onboardingTemplateCreateHandler)
routes.post("/onboarding/template-update", ...onboardingTemplateUpdateHandler)
routes.post("/onboarding/template-delete", ...onboardingTemplateDeleteHandler)
routes.post("/onboarding/template/:code?", ...onboardingTemplateShowHandler)
routes.post("/review/cycle/update", ...reviewCycleUpdateHandler)
routes.post("/review/cycle/delete", ...reviewCycleDeleteHandler)
routes.post("/review/cycle/open", ...reviewCycleOpenHandler)
routes.post("/review/cycle/close", ...reviewCycleCloseHandler)

// #100: 未登録だったルートを追加（ファイル構造から POST パスを導出）
routes.post("/1on1/delete", ...cmd1on1DeleteHandler)
routes.post("/1on1/edit", ...cmd1on1EditHandler)
routes.post("/1on1/mine", ...cmd1on1MineHandler)
routes.post("/1on1/show", ...cmd1on1ShowHandler)
routes.post("/application/mine", ...applicationMineHandler)
routes.post("/application/show", ...applicationShowHandler)
routes.post("/application/update", ...applicationUpdateHandler)
routes.post("/application/withdraw", ...applicationWithdrawHandler)
routes.post("/asset/delete/:asset_code?", ...assetDeleteHandler)
routes.post("/asset/update/:asset_code?", ...assetUpdateHandler)
routes.post("/career/application-show", ...careerApplicationShowHandler)
routes.post("/career/application-update", ...careerApplicationUpdateHandler)
routes.post("/career/applications", ...careerApplicationsHandler)
routes.post("/career/sheet-delete", ...careerSheetDeleteHandler)
routes.post("/career/withdraw", ...careerWithdrawHandler)
routes.post("/employee/delete/:employee_code?", ...employeeDeleteHandler)
routes.post("/employee/register", ...employeeRegisterHandler)
routes.post("/employee/show/:employee_code?", ...employeeShowHandler)
routes.post("/employee/update/:employee_code?", ...employeeUpdateHandler)
routes.post("/expense/delete/:expense_id?", ...expenseDeleteHandler)
routes.post("/expense/update/:expense_id?", ...expenseUpdateHandler)
routes.post("/goal/delete", ...goalDeleteHandler)
routes.post("/goal/mine", ...goalMineHandler)
routes.post("/goal/show", ...goalShowHandler)
routes.post("/goal/update", ...goalUpdateHandler)
routes.post("/kb/add", ...kbAddHandler)
routes.post("/kb/delete", ...kbDeleteHandler)
routes.post("/kb/edit", ...kbEditHandler)
routes.post("/leave/cancel", ...leaveCancelHandler)
routes.post("/leave/show", ...leaveShowHandler)
routes.post("/leave/update", ...leaveUpdateHandler)
routes.post("/notify/delete", ...notifyDeleteHandler)
routes.post("/notify/show", ...notifyShowHandler)
routes.post("/onboarding/assignment/cancel/:assignment_id?", ...onboardingAssignmentCancelHandler)
routes.post("/onboarding/assignment/show/:assignment_id?", ...onboardingAssignmentShowHandler)
routes.post("/onboarding/assignment/update/:assignment_id?", ...onboardingAssignmentUpdateHandler)
routes.post("/onboarding/uncomplete/:task_id?", ...onboardingUncompleteHandler)
routes.post("/org/dept/create", ...orgDeptCreateHandler)
routes.post("/org/dept/delete", ...orgDeptDeleteHandler)
routes.post("/org/dept/list", ...orgDeptListHandler)
routes.post("/org/dept/show", ...orgDeptShowHandler)
routes.post("/org/dept/update", ...orgDeptUpdateHandler)
routes.post("/shift/assignment-delete", ...shiftAssignmentDeleteHandler)
routes.post("/shift/assignment-show", ...shiftAssignmentShowHandler)
routes.post("/shift/assignment-update", ...shiftAssignmentUpdateHandler)
routes.post("/shift/pattern-delete", ...shiftPatternDeleteHandler)
routes.post("/shift/pattern-show", ...shiftPatternShowHandler)
routes.post("/shift/pattern-update", ...shiftPatternUpdateHandler)
routes.post("/shift/swap-cancel", ...shiftSwapCancelHandler)
routes.post("/shift/swap-mine", ...shiftSwapMineHandler)
routes.post("/shift/swap-show", ...shiftSwapShowHandler)
routes.post("/skill/remove/:skill_code?", ...skillRemoveHandler)
routes.post("/skill/show/:skill_code?", ...skillShowHandler)
routes.post("/survey/edit/:response_id?", ...surveyEditHandler)
routes.post("/survey/response/:response_id?", ...surveyResponseHandler)
routes.post("/survey/responses", ...surveyResponsesHandler)
routes.post("/survey/withdraw/:response_id?", ...surveyWithdrawHandler)
routes.post("/training/cancel", ...trainingCancelHandler)
routes.post("/training/course-archive", ...trainingCourseArchiveHandler)
routes.post("/training/course-update", ...trainingCourseUpdateHandler)
routes.post("/training/reschedule", ...trainingRescheduleHandler)
routes.post("/training/show", ...trainingShowHandler)

export const app = routes
