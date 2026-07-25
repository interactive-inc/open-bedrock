import { HTTPException } from "hono/http-exception"
import { factory } from "@/factory"
import { loadConfig } from "@/lib/config/load-config"
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
import partnersHandler from "@/app/partners/route"
import partnersListHandler from "@/app/partners/list/route"
import partnersShowHandler from "@/app/partners/show/[partner_code]/route"
import partnersRegisterHandler from "@/app/partners/register/route"
import partnersUpdateHandler from "@/app/partners/update/[partner_id]/route"
import partnersArchiveHandler from "@/app/partners/archive/[partner_id]/route"
import contractsHandler from "@/app/contracts/route"
import contractsListHandler from "@/app/contracts/list/route"
import contractsCreateHandler from "@/app/contracts/create/route"
import contractsUpdateHandler from "@/app/contracts/update/[contract_id]/route"
import attendanceClockInHandler from "@/app/attendance/clock-in/route"
import attendanceClockOutHandler from "@/app/attendance/clock-out/route"
import attendanceHandler from "@/app/attendance/route"
import attendanceListHandler from "@/app/attendance/list/route"
import attendanceMeHandler from "@/app/attendance/me/route"
import attendanceSummaryHandler from "@/app/attendance/summary/route"
import attendanceOvertimeHandler from "@/app/attendance/overtime/route"
import calendarHandler from "@/app/calendar/route"
import calendarListHandler from "@/app/calendar/list/route"
import calendarAddHandler from "@/app/calendar/add/route"
import calendarDeleteHandler from "@/app/calendar/delete/route"
import workStylesHandler from "@/app/work-styles/route"
import workStylesListHandler from "@/app/work-styles/list/route"
import workStylesAddHandler from "@/app/work-styles/add/route"
import batchHandler from "@/app/batch/route"
import batchMigratePasswordHashesHandler from "@/app/batch/migrate-password-hashes/route"
import careerApplyHandler from "@/app/career/apply/[posting_id]/route"
import careerHandler from "@/app/career/route"
import careerPostingsHandler from "@/app/career/postings/route"
import careerSheetHandler from "@/app/career/sheet/route"
import careerSheetUpdateHandler from "@/app/career/sheet-update/route"
import dashboardHandler from "@/app/dashboard/route"
import dashboardManagementHandler from "@/app/dashboard/management/route"
import employeeHandler from "@/app/employee/route"
import employeeSearchHandler from "@/app/employee/search/route"
import expenseApproveHandler from "@/app/expense/approve/[expense_id]/route"
import expenseHandler from "@/app/expense/route"
import expenseInboxHandler from "@/app/expense/inbox/route"
import expenseMineHandler from "@/app/expense/mine/route"
import expenseRejectHandler from "@/app/expense/reject/[expense_id]/route"
import expenseShowHandler from "@/app/expense/show/[expense_id]/route"
import expenseSubmitHandler from "@/app/expense/submit/route"
import ringiHandler from "@/app/ringi/route"
import ringiAdminHandler from "@/app/ringi/admin/route"
import ringiApproveHandler from "@/app/ringi/approve/[ringi_id]/route"
import ringiInboxHandler from "@/app/ringi/inbox/route"
import ringiMeHandler from "@/app/ringi/me/route"
import ringiRejectHandler from "@/app/ringi/reject/[ringi_id]/route"
import ringiSubmitHandler from "@/app/ringi/submit/route"
import budgetHandler from "@/app/budget/route"
import budgetListHandler from "@/app/budget/list/route"
import budgetShowHandler from "@/app/budget/show/[budget_id]/route"
import budgetSummaryHandler from "@/app/budget/summary/route"
import budgetCreateHandler from "@/app/budget/create/route"
import budgetUpdateHandler from "@/app/budget/update/[budget_id]/route"
import budgetDeleteHandler from "@/app/budget/delete/[budget_id]/route"
import goalCreateHandler from "@/app/goal/create/route"
import goalEvaluateHandler from "@/app/goal/evaluate/[goal_id]/route"
import goalHandler from "@/app/goal/route"
import goalListHandler from "@/app/goal/list/route"
import goalTreeHandler from "@/app/goal/tree/route"
import gradesHandler from "@/app/grades/route"
import gradesListHandler from "@/app/grades/list/route"
import gradesCreateHandler from "@/app/grades/create/route"
import gradesUpdateHandler from "@/app/grades/update/route"
import gradesDeleteHandler from "@/app/grades/delete/route"
import gradesAssignmentsHandler from "@/app/grades/assignments/route"
import gradesAssignHandler from "@/app/grades/assign/route"
import positionsHandler from "@/app/positions/route"
import positionsListHandler from "@/app/positions/list/route"
import positionsCreateHandler from "@/app/positions/create/route"
import positionsUpdateHandler from "@/app/positions/update/route"
import positionsDeleteHandler from "@/app/positions/delete/route"
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
import bootstrapHandler from "@/app/bootstrap/route"
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
import reviewFormsHandler from "@/app/review/forms/route"
import reviewFormsBulkHandler from "@/app/review/forms-bulk/route"
import reviewDiscloseHandler from "@/app/review/disclose/route"
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
import certificationsHandler from "@/app/certifications/route"
import certificationsCreateHandler from "@/app/certifications/create/route"
import certificationsUpdateHandler from "@/app/certifications/update/[id]/route"
import certificationsRecordsHandler from "@/app/certifications/records/route"
import certificationsRecordAddHandler from "@/app/certifications/record-add/route"
import certificationsRecordRemoveHandler from "@/app/certifications/record-remove/[id]/route"
import healthCheckupsHandler from "@/app/health-checkups/route"
import healthCheckupsCreateHandler from "@/app/health-checkups/create/route"
import healthCheckupsCompleteHandler from "@/app/health-checkups/complete/[id]/route"
import workAccidentsHandler from "@/app/work-accidents/route"
import workAccidentsCreateHandler from "@/app/work-accidents/create/route"
import workAccidentsCloseHandler from "@/app/work-accidents/close/[id]/route"
import trainingCompleteHandler from "@/app/training/complete/[id]/route"
import trainingCourseHandler from "@/app/training/course/[code]/route"
import trainingCourseCreateHandler from "@/app/training/course-create/route"
import trainingCoursesHandler from "@/app/training/courses/route"
import trainingEnrollHandler from "@/app/training/enroll/route"
import trainingEnrollmentsHandler from "@/app/training/enrollments/route"
import trainingHandler from "@/app/training/route"
import trainingMineHandler from "@/app/training/mine/route"
import whoamiHandler from "@/app/whoami/route"
import governanceHandler from "@/app/governance/route"
import governanceAcknowledgeHandler from "@/app/governance/acknowledge/[code]/route"
import governanceAssignRoleHandler from "@/app/governance/assign-role/[code]/route"
import governanceImpactHandler from "@/app/governance/impact/route"
import governanceListHandler from "@/app/governance/list/route"
import governanceOrgRolesHandler from "@/app/governance/org-roles/route"
import governancePublishHandler from "@/app/governance/publish/[code]/route"
import governanceReviewHandler from "@/app/governance/review/[code]/route"
import governanceRevokeRoleHandler from "@/app/governance/revoke-role/[assignment_id]/route"
import governanceShowHandler from "@/app/governance/show/[code]/route"
import governanceSubmitReviewHandler from "@/app/governance/submit-review/[code]/route"
import governanceSyncHandler from "@/app/governance/sync/route"
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
import appWorkflowHandler from "@/app/app/workflow/[code]/route"
import appWorkflowRepairListHandler from "@/app/app/workflow-repair/list/route"
import appWorkflowRepairReassignHandler from "@/app/app/workflow-repair/reassign/[app_id]/route"
import appResubmitHandler from "@/app/app/resubmit/[app_id]/route"
import appDelegationsHandler from "@/app/app/delegations/route"
import appDelegateHandler from "@/app/app/delegate/route"
import appDelegationDeleteHandler from "@/app/app/delegation-delete/[id]/route"
import reviewCyclePolicyHandler from "@/app/review/cycle/policy/route"
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
import onboardingTemplateBindLifecycleHandler from "@/app/onboarding/template-bind-lifecycle/[template_code]/route"
import onboardingTemplateUnbindLifecycleHandler from "@/app/onboarding/template-unbind-lifecycle/[template_code]/route"
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
import assetDisposeHandler from "@/app/asset/dispose/[asset_code]/route"
import assetHoldingsHandler from "@/app/asset/holdings/route"
import stocktakeHandler from "@/app/stocktake/route"
import stocktakeListHandler from "@/app/stocktake/list/route"
import stocktakeStartHandler from "@/app/stocktake/start/route"
import stocktakeShowHandler from "@/app/stocktake/show/[stocktake_id]/route"
import stocktakeCheckHandler from "@/app/stocktake/check/[stocktake_id]/route"
import stocktakeCloseHandler from "@/app/stocktake/close/[stocktake_id]/route"
import careerApplicationShowHandler from "@/app/career/application-show/route"
import careerApplicationUpdateHandler from "@/app/career/application-update/route"
import careerApplicationsHandler from "@/app/career/applications/route"
import careerSheetDeleteHandler from "@/app/career/sheet-delete/route"
import careerWithdrawHandler from "@/app/career/withdraw/route"
import employeeDeleteHandler from "@/app/employee/delete/[employee_code]/route"
import employeeRegisterHandler from "@/app/employee/register/route"
import employeeShowHandler from "@/app/employee/show/[employee_code]/route"
import employeeUpdateHandler from "@/app/employee/update/[employee_code]/route"
import employeeTimelineHandler from "@/app/employee/timeline/route"
import employeeStateHandler from "@/app/employee/state/route"
import employeeArchiveHandler from "@/app/employee/archive/route"
import personnelActionRequestHandler from "@/app/personnel-action/request/route"
import personnelActionApplyHandler from "@/app/personnel-action/apply/route"
import personnelActionCorrectHandler from "@/app/personnel-action/correct/route"
import lifecyclePreflightHandler from "@/app/batch/employee-lifecycle/preflight/route"
import lifecycleBackfillHandler from "@/app/batch/employee-lifecycle/backfill/route"
import lifecycleVerifyHandler from "@/app/batch/employee-lifecycle/verify/route"
import lifecycleRebuildHandler from "@/app/batch/employee-lifecycle/rebuild-projections/route"
import lifecycleOutboxHandler from "@/app/batch/employee-lifecycle/process-outbox/route"
import expenseDeleteHandler from "@/app/expense/delete/[expense_id]/route"
import expenseUpdateHandler from "@/app/expense/update/[expense_id]/route"
import goalDeleteHandler from "@/app/goal/delete/route"
import goalMineHandler from "@/app/goal/mine/route"
import goalShowHandler from "@/app/goal/show/route"
import goalUpdateHandler from "@/app/goal/update/route"
import kbAddHandler from "@/app/kb/add/route"
import kbDeleteHandler from "@/app/kb/delete/route"
import kbEditHandler from "@/app/kb/edit/route"
import announcementsHandler from "@/app/announcements/route"
import announcementsListHandler from "@/app/announcements/list/route"
import announcementsShowHandler from "@/app/announcements/show/[announcement_id]/route"
import announcementsCreateHandler from "@/app/announcements/create/route"
import announcementsUpdateHandler from "@/app/announcements/update/[announcement_id]/route"
import announcementsPublishHandler from "@/app/announcements/publish/[announcement_id]/route"
import announcementsArchiveHandler from "@/app/announcements/archive/[announcement_id]/route"
import regulationsHandler from "@/app/regulations/route"
import regulationsListHandler from "@/app/regulations/list/route"
import regulationsShowHandler from "@/app/regulations/show/[regulation_code]/route"
import regulationsRegisterHandler from "@/app/regulations/register/route"
import regulationsAddVersionHandler from "@/app/regulations/add-version/[regulation_code]/route"
import regulationsArchiveHandler from "@/app/regulations/archive/[regulation_code]/route"
import documentsHandler from "@/app/documents/route"
import documentsListHandler from "@/app/documents/list/route"
import documentsRegisterHandler from "@/app/documents/register/route"
import documentsUpdateHandler from "@/app/documents/update/[document_id]/route"
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
import meetingsHandler from "@/app/meetings/route"
import meetingsListHandler from "@/app/meetings/list/route"
import meetingsShowHandler from "@/app/meetings/show/[code]/route"
import meetingsCreateHandler from "@/app/meetings/create/route"
import meetingsUpdateHandler from "@/app/meetings/update/[code]/route"
import meetingsArchiveHandler from "@/app/meetings/archive/[code]/route"
import minutesHandler from "@/app/minutes/route"
import minutesListHandler from "@/app/minutes/list/[meeting_code]/route"
import minutesShowHandler from "@/app/minutes/show/[id]/route"
import minutesAddHandler from "@/app/minutes/add/[meeting_code]/route"
import minutesEditHandler from "@/app/minutes/edit/[id]/route"
import decisionsHandler from "@/app/decisions/route"
import decisionsListHandler from "@/app/decisions/list/route"
import decisionsShowHandler from "@/app/decisions/show/[id]/route"
import decisionsCreateHandler from "@/app/decisions/create/route"
import decisionsUpdateHandler from "@/app/decisions/update/[id]/route"
import decisionsSupersedeHandler from "@/app/decisions/supersede/[id]/route"
import recruitmentHandler from "@/app/recruitment/route"
import recruitmentPositionsHandler from "@/app/recruitment/positions/route"
import recruitmentPositionCreateHandler from "@/app/recruitment/position-create/route"
import recruitmentPositionUpdateHandler from "@/app/recruitment/position-update/[id]/route"
import recruitmentCandidatesHandler from "@/app/recruitment/candidates/[position_id]/route"
import recruitmentCandidateAddHandler from "@/app/recruitment/candidate-add/[position_id]/route"
import recruitmentAdvanceHandler from "@/app/recruitment/advance/[id]/route"
import commendationsHandler from "@/app/commendations/route"
import commendationsListHandler from "@/app/commendations/list/route"
import commendationsCreateHandler from "@/app/commendations/create/route"
import commendationsDeleteHandler from "@/app/commendations/delete/[id]/route"
import disciplinaryActionsHandler from "@/app/disciplinary-actions/route"
import disciplinaryActionsListHandler from "@/app/disciplinary-actions/list/route"
import disciplinaryActionsCreateHandler from "@/app/disciplinary-actions/create/route"
import headcountPlansHandler from "@/app/headcount-plans/route"
import headcountPlansListHandler from "@/app/headcount-plans/list/route"
import headcountPlansCreateHandler from "@/app/headcount-plans/create/route"
import headcountPlansUpdateHandler from "@/app/headcount-plans/update/[id]/route"
import licensesHandler from "@/app/licenses/route"
import licensesListHandler from "@/app/licenses/list/route"
import licensesCreateHandler from "@/app/licenses/create/route"
import licensesUpdateHandler from "@/app/licenses/update/[license_id]/route"
import licensesCancelHandler from "@/app/licenses/cancel/[license_id]/route"
import itIncidentsHandler from "@/app/it-incidents/route"
import itIncidentsListHandler from "@/app/it-incidents/list/route"
import itIncidentsCreateHandler from "@/app/it-incidents/create/route"
import itIncidentsResolveHandler from "@/app/it-incidents/resolve/[incident_id]/route"
import salaryRevisionsHandler from "@/app/salary-revisions/route"
import salaryRevisionsListHandler from "@/app/salary-revisions/list/route"
import salaryRevisionsCreateHandler from "@/app/salary-revisions/create/route"

const base = factory.createApp()

base.onError(async (error, c) => {
  // ハンドラに到達して投げられたエラーであることを示すマーカー。
  // 未登録パスで Hono が返す素の 404 と、ハンドラ由来の 404 を index.ts で区別する。
  c.header("x-bedrock-handler-error", "1")

  if (error instanceof HTTPException) {
    if (error.status === 401) {
      return c.text(
        `${error.message}\n認証されていません。'bedrock login' でログインしてください。`,
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

/**
 * すべて POST で登録する。位置引数は path param、`--flag value` は JSON body。
 * ファイル構造（routes/<path>/route.ts、Next.js App Router 記法）に対応する。
 */
const routes = base

routes.post("/login", ...loginHandler)
routes.post("/bootstrap", ...bootstrapHandler)
routes.post("/whoami", ...whoamiHandler)

routes.post("/governance", ...governanceHandler)
routes.post("/governance/list", ...governanceListHandler)
routes.post("/governance/show/:code?", ...governanceShowHandler)
routes.post("/governance/sync", ...governanceSyncHandler)
routes.post("/governance/impact", ...governanceImpactHandler)
routes.post("/governance/submit-review/:code?", ...governanceSubmitReviewHandler)
routes.post("/governance/review/:code?", ...governanceReviewHandler)
routes.post("/governance/publish/:code?", ...governancePublishHandler)
routes.post("/governance/acknowledge/:code?", ...governanceAcknowledgeHandler)
routes.post("/governance/org-roles", ...governanceOrgRolesHandler)
routes.post("/governance/assign-role/:code?", ...governanceAssignRoleHandler)
routes.post("/governance/revoke-role/:assignment_id?", ...governanceRevokeRoleHandler)

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
routes.post("/budget", ...budgetHandler)
routes.post("/budget/list", ...budgetListHandler)
routes.post("/budget/summary", ...budgetSummaryHandler)
routes.post("/budget/create", ...budgetCreateHandler)
routes.post("/budget/show/:budget_id?", ...budgetShowHandler)
routes.post("/budget/update/:budget_id?", ...budgetUpdateHandler)
routes.post("/budget/delete/:budget_id?", ...budgetDeleteHandler)

routes.post("/ringi", ...ringiHandler)
routes.post("/ringi/submit", ...ringiSubmitHandler)
routes.post("/ringi/me", ...ringiMeHandler)
routes.post("/ringi/inbox", ...ringiInboxHandler)
routes.post("/ringi/approve/:ringi_id?", ...ringiApproveHandler)
routes.post("/ringi/reject/:ringi_id?", ...ringiRejectHandler)
routes.post("/ringi/admin", ...ringiAdminHandler)

routes.post("/goal", ...goalHandler)
routes.post("/goal/list", ...goalListHandler)
routes.post("/goal/tree", ...goalTreeHandler)
routes.post("/goal/create", ...goalCreateHandler)
routes.post("/goal/evaluate/:goal_id?", ...goalEvaluateHandler)

routes.post("/grades", ...gradesHandler)
routes.post("/grades/list", ...gradesListHandler)
routes.post("/grades/create", ...gradesCreateHandler)
routes.post("/grades/update", ...gradesUpdateHandler)
routes.post("/grades/delete", ...gradesDeleteHandler)
routes.post("/grades/assignments", ...gradesAssignmentsHandler)
routes.post("/grades/assign", ...gradesAssignHandler)
routes.post("/positions", ...positionsHandler)
routes.post("/positions/list", ...positionsListHandler)
routes.post("/positions/create", ...positionsCreateHandler)
routes.post("/positions/update", ...positionsUpdateHandler)
routes.post("/positions/delete", ...positionsDeleteHandler)

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
routes.post("/asset/dispose/:asset_code?", ...assetDisposeHandler)
routes.post("/asset/holdings", ...assetHoldingsHandler)

routes.post("/stocktake", ...stocktakeHandler)
routes.post("/stocktake/list", ...stocktakeListHandler)
routes.post("/stocktake/start", ...stocktakeStartHandler)
routes.post("/stocktake/show/:stocktake_id?", ...stocktakeShowHandler)
routes.post("/stocktake/check/:stocktake_id?", ...stocktakeCheckHandler)
routes.post("/stocktake/close/:stocktake_id?", ...stocktakeCloseHandler)

routes.post("/partners", ...partnersHandler)
routes.post("/partners/list", ...partnersListHandler)
routes.post("/partners/show/:partner_code?", ...partnersShowHandler)
routes.post("/partners/register", ...partnersRegisterHandler)
routes.post("/partners/update/:partner_id?", ...partnersUpdateHandler)
routes.post("/partners/archive/:partner_id?", ...partnersArchiveHandler)

routes.post("/contracts", ...contractsHandler)
routes.post("/contracts/list", ...contractsListHandler)
routes.post("/contracts/create", ...contractsCreateHandler)
routes.post("/contracts/update/:contract_id?", ...contractsUpdateHandler)

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
routes.post("/attendance/overtime", ...attendanceOvertimeHandler)

routes.post("/calendar", ...calendarHandler)
routes.post("/calendar/list", ...calendarListHandler)
routes.post("/calendar/add", ...calendarAddHandler)
routes.post("/calendar/delete", ...calendarDeleteHandler)

routes.post("/work-styles", ...workStylesHandler)
routes.post("/work-styles/list", ...workStylesListHandler)
routes.post("/work-styles/add", ...workStylesAddHandler)

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
routes.post("/onboarding/complete/:task_id?", ...onboardingCompleteHandler)
routes.post("/onboarding/show/:employee_code?", ...onboardingShowHandler)

routes.post("/review", ...reviewHandler)
routes.post("/review/cycles", ...reviewCyclesHandler)
routes.post("/review/cycle", ...reviewCycleHandler)
routes.post("/review/cycle/create", ...reviewCycleCreateHandler)
routes.post("/review/mine", ...reviewMineHandler)
routes.post("/review/forms", ...reviewFormsHandler)
routes.post("/review/forms-bulk", ...reviewFormsBulkHandler)
routes.post("/review/disclose", ...reviewDiscloseHandler)
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
routes.post("/dashboard/management", ...dashboardManagementHandler)
routes.post("/business-trip", ...businessTripHandler)
routes.post("/business-trip/request", ...businessTripRequestHandler)
routes.post("/business-trip/mine", ...businessTripMineHandler)
routes.post("/business-trip/admin", ...businessTripAdminHandler)
routes.post("/business-trip/show", ...businessTripShowHandler)
routes.post("/business-trip/update", ...businessTripUpdateHandler)
routes.post("/business-trip/cancel", ...businessTripCancelHandler)
routes.post("/business-trip/approve", ...businessTripApproveHandler)
routes.post("/business-trip/reject", ...businessTripRejectHandler)
routes.post("/certifications", ...certificationsHandler)
routes.post("/certifications/create", ...certificationsCreateHandler)
routes.post("/certifications/update/:id?", ...certificationsUpdateHandler)
routes.post("/certifications/records", ...certificationsRecordsHandler)
routes.post("/certifications/record-add", ...certificationsRecordAddHandler)
routes.post("/certifications/record-remove/:id?", ...certificationsRecordRemoveHandler)

routes.post("/health-checkups", ...healthCheckupsHandler)
routes.post("/health-checkups/create", ...healthCheckupsCreateHandler)
routes.post("/health-checkups/complete/:id?", ...healthCheckupsCompleteHandler)

routes.post("/work-accidents", ...workAccidentsHandler)
routes.post("/work-accidents/create", ...workAccidentsCreateHandler)
routes.post("/work-accidents/close/:id?", ...workAccidentsCloseHandler)

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
routes.post("/app/workflow/:code?", ...appWorkflowHandler)
routes.post("/app/workflow-repair/list", ...appWorkflowRepairListHandler)
routes.post("/app/workflow-repair/reassign/:app_id?", ...appWorkflowRepairReassignHandler)
routes.post("/app/resubmit/:app_id?", ...appResubmitHandler)
routes.post("/app/delegations", ...appDelegationsHandler)
routes.post("/app/delegate", ...appDelegateHandler)
routes.post("/app/delegation-delete/:id?", ...appDelegationDeleteHandler)
routes.post("/review/cycle/policy", ...reviewCyclePolicyHandler)
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
routes.post(
  "/onboarding/template-bind-lifecycle/:template_code?",
  ...onboardingTemplateBindLifecycleHandler,
)
routes.post(
  "/onboarding/template-unbind-lifecycle/:template_code?",
  ...onboardingTemplateUnbindLifecycleHandler,
)
routes.post("/onboarding/template/:code?", ...onboardingTemplateShowHandler)
routes.post("/review/cycle/update", ...reviewCycleUpdateHandler)
routes.post("/review/cycle/delete", ...reviewCycleDeleteHandler)
routes.post("/review/cycle/open", ...reviewCycleOpenHandler)
routes.post("/review/cycle/close", ...reviewCycleCloseHandler)

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
routes.post("/employee/timeline", ...employeeTimelineHandler)
routes.post("/employee/state", ...employeeStateHandler)
routes.post("/employee/archive", ...employeeArchiveHandler)
routes.post("/personnel-action/request", ...personnelActionRequestHandler)
routes.post("/personnel-action/apply", ...personnelActionApplyHandler)
routes.post("/personnel-action/correct", ...personnelActionCorrectHandler)
routes.post("/batch/employee-lifecycle/preflight", ...lifecyclePreflightHandler)
routes.post("/batch/employee-lifecycle/backfill", ...lifecycleBackfillHandler)
routes.post("/batch/employee-lifecycle/verify", ...lifecycleVerifyHandler)
routes.post("/batch/employee-lifecycle/rebuild-projections", ...lifecycleRebuildHandler)
routes.post("/batch/employee-lifecycle/process-outbox", ...lifecycleOutboxHandler)
routes.post("/expense/delete/:expense_id?", ...expenseDeleteHandler)
routes.post("/expense/update/:expense_id?", ...expenseUpdateHandler)
routes.post("/goal/delete", ...goalDeleteHandler)
routes.post("/goal/mine", ...goalMineHandler)
routes.post("/goal/show", ...goalShowHandler)
routes.post("/goal/update", ...goalUpdateHandler)
routes.post("/kb/add", ...kbAddHandler)
routes.post("/kb/delete", ...kbDeleteHandler)
routes.post("/kb/edit", ...kbEditHandler)
routes.post("/announcements", ...announcementsHandler)
routes.post("/announcements/list", ...announcementsListHandler)
routes.post("/announcements/show/:announcement_id?", ...announcementsShowHandler)
routes.post("/announcements/create", ...announcementsCreateHandler)
routes.post("/announcements/update/:announcement_id?", ...announcementsUpdateHandler)
routes.post("/announcements/publish/:announcement_id?", ...announcementsPublishHandler)
routes.post("/announcements/archive/:announcement_id?", ...announcementsArchiveHandler)
routes.post("/regulations", ...regulationsHandler)
routes.post("/regulations/list", ...regulationsListHandler)
routes.post("/regulations/show/:regulation_code?", ...regulationsShowHandler)
routes.post("/regulations/register", ...regulationsRegisterHandler)
routes.post("/regulations/add-version/:regulation_code?", ...regulationsAddVersionHandler)
routes.post("/regulations/archive/:regulation_code?", ...regulationsArchiveHandler)
routes.post("/documents", ...documentsHandler)
routes.post("/documents/list", ...documentsListHandler)
routes.post("/documents/register", ...documentsRegisterHandler)
routes.post("/documents/update/:document_id?", ...documentsUpdateHandler)
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
routes.post("/meetings", ...meetingsHandler)
routes.post("/meetings/list", ...meetingsListHandler)
routes.post("/meetings/show/:code?", ...meetingsShowHandler)
routes.post("/meetings/create", ...meetingsCreateHandler)
routes.post("/meetings/update/:code?", ...meetingsUpdateHandler)
routes.post("/meetings/archive/:code?", ...meetingsArchiveHandler)
routes.post("/minutes", ...minutesHandler)
routes.post("/minutes/list/:meeting_code?", ...minutesListHandler)
routes.post("/minutes/show/:id?", ...minutesShowHandler)
routes.post("/minutes/add/:meeting_code?", ...minutesAddHandler)
routes.post("/minutes/edit/:id?", ...minutesEditHandler)
routes.post("/decisions", ...decisionsHandler)
routes.post("/decisions/list", ...decisionsListHandler)
routes.post("/decisions/show/:id?", ...decisionsShowHandler)
routes.post("/decisions/create", ...decisionsCreateHandler)
routes.post("/decisions/update/:id?", ...decisionsUpdateHandler)
routes.post("/decisions/supersede/:id?", ...decisionsSupersedeHandler)
routes.post("/recruitment", ...recruitmentHandler)
routes.post("/recruitment/positions", ...recruitmentPositionsHandler)
routes.post("/recruitment/position-create", ...recruitmentPositionCreateHandler)
routes.post("/recruitment/position-update/:id?", ...recruitmentPositionUpdateHandler)
routes.post("/recruitment/candidates/:position_id?", ...recruitmentCandidatesHandler)
routes.post("/recruitment/candidate-add/:position_id?", ...recruitmentCandidateAddHandler)
routes.post("/recruitment/advance/:id?", ...recruitmentAdvanceHandler)
routes.post("/commendations", ...commendationsHandler)
routes.post("/commendations/list", ...commendationsListHandler)
routes.post("/commendations/create", ...commendationsCreateHandler)
routes.post("/commendations/delete/:id?", ...commendationsDeleteHandler)
routes.post("/disciplinary-actions", ...disciplinaryActionsHandler)
routes.post("/disciplinary-actions/list", ...disciplinaryActionsListHandler)
routes.post("/disciplinary-actions/create", ...disciplinaryActionsCreateHandler)
routes.post("/headcount-plans", ...headcountPlansHandler)
routes.post("/headcount-plans/list", ...headcountPlansListHandler)
routes.post("/headcount-plans/create", ...headcountPlansCreateHandler)
routes.post("/headcount-plans/update/:id?", ...headcountPlansUpdateHandler)
routes.post("/licenses", ...licensesHandler)
routes.post("/licenses/list", ...licensesListHandler)
routes.post("/licenses/create", ...licensesCreateHandler)
routes.post("/licenses/update/:license_id?", ...licensesUpdateHandler)
routes.post("/licenses/cancel/:license_id?", ...licensesCancelHandler)
routes.post("/it-incidents", ...itIncidentsHandler)
routes.post("/it-incidents/list", ...itIncidentsListHandler)
routes.post("/it-incidents/create", ...itIncidentsCreateHandler)
routes.post("/it-incidents/resolve/:incident_id?", ...itIncidentsResolveHandler)
routes.post("/salary-revisions", ...salaryRevisionsHandler)
routes.post("/salary-revisions/list", ...salaryRevisionsListHandler)
routes.post("/salary-revisions/create", ...salaryRevisionsCreateHandler)

export const app = routes
