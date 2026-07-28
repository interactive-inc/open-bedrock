import { HTTPException } from "hono/http-exception"
import { factory } from "@/factory"
import { loadConfig } from "@/lib/config/load-config"
import { toConnectionErrorMessage } from "@/lib/http/to-connection-error-message"
import appApproveHandler from "@/app/application-requests/approve/[app_id]/route"
import appHandler from "@/app/application-requests/route"
import appInboxHandler from "@/app/application-requests/inbox/route"
import appMineHandler from "@/app/application-requests/mine/route"
import appRejectHandler from "@/app/application-requests/reject/[app_id]/route"
import appShowHandler from "@/app/application-requests/show/[app_id]/route"
import appSubmitHandler from "@/app/application-requests/submit/[template_code]/route"
import appTemplateHandler from "@/app/application-requests/template/[code]/route"
import appTemplatesHandler from "@/app/application-requests/templates/route"
import assetHandler from "@/app/assets/route"
import assetLendHandler from "@/app/assets/lend/[asset_code]/route"
import assetListHandler from "@/app/assets/list/route"
import assetMineHandler from "@/app/assets/lent/me/route"
import assetRegisterHandler from "@/app/assets/register/route"
import assetReturnHandler from "@/app/assets/return/[asset_code]/route"
import assetShowHandler from "@/app/assets/show/[asset_code]/route"
import partnersHandler from "@/app/partners/route"
import partnersListHandler from "@/app/partners/list/route"
import partnersShowHandler from "@/app/partners/show/[partner_code]/route"
import partnersRegisterHandler from "@/app/partners/register/route"
import partnersUpdateHandler from "@/app/partners/update/[partner_id]/route"
import partnersArchiveHandler from "@/app/partners/archive/[partner_id]/route"
import contractsHandler from "@/app/partner-contracts/route"
import contractsListHandler from "@/app/partner-contracts/list/route"
import contractsCreateHandler from "@/app/partner-contracts/create/route"
import contractsUpdateHandler from "@/app/partner-contracts/update/[contract_id]/route"
import attendanceClockInHandler from "@/app/attendance-records/clock-in/route"
import attendanceClockOutHandler from "@/app/attendance-records/clock-out/route"
import attendanceHandler from "@/app/attendance-records/route"
import attendanceListHandler from "@/app/attendance-records/list/route"
import attendanceMeHandler from "@/app/attendance-records/me/route"
import attendanceSummaryHandler from "@/app/attendance-records/summary/route"
import attendanceOvertimeHandler from "@/app/attendance-records/overtime/route"
import calendarHandler from "@/app/company-calendar-days/route"
import calendarListHandler from "@/app/company-calendar-days/list/route"
import calendarAddHandler from "@/app/company-calendar-days/add/route"
import calendarDeleteHandler from "@/app/company-calendar-days/delete/route"
import workStylesHandler from "@/app/employee-work-styles/route"
import workStylesListHandler from "@/app/employee-work-styles/list/route"
import workStylesAddHandler from "@/app/employee-work-styles/add/route"
import batchHandler from "@/app/batch/route"
import batchMigratePasswordHashesHandler from "@/app/batch/migrate-password-hashes/route"
import careerApplyHandler from "@/app/career-applications/create/[posting_id]/route"
import careerApplicationsRootHandler from "@/app/career-applications/route"
import careerPostingsRootHandler from "@/app/career-postings/route"
import careerSheetsRootHandler from "@/app/career-sheets/route"
import careerPostingsHandler from "@/app/career-postings/list/route"
import careerSheetHandler from "@/app/career-sheets/show/route"
import careerSheetUpdateHandler from "@/app/career-sheets/update/route"
import dashboardHandler from "@/app/dashboard/route"
import dashboardManagementHandler from "@/app/dashboard/management/route"
import employeeHandler from "@/app/employees/route"
import employeeSearchHandler from "@/app/employees/search/route"
import expenseApproveHandler from "@/app/expenses/approve/[expense_id]/route"
import expenseHandler from "@/app/expenses/route"
import expenseInboxHandler from "@/app/expenses/inbox/route"
import expenseMineHandler from "@/app/expenses/mine/route"
import expenseRejectHandler from "@/app/expenses/reject/[expense_id]/route"
import expenseShowHandler from "@/app/expenses/show/[expense_id]/route"
import expenseSubmitHandler from "@/app/expenses/submit/route"
import ringiHandler from "@/app/ringi-requests/route"
import ringiAdminHandler from "@/app/ringi-requests/admin/route"
import ringiApproveHandler from "@/app/ringi-requests/approve/[ringi_id]/route"
import ringiInboxHandler from "@/app/ringi-requests/inbox/route"
import ringiMeHandler from "@/app/ringi-requests/me/route"
import ringiRejectHandler from "@/app/ringi-requests/reject/[ringi_id]/route"
import ringiSubmitHandler from "@/app/ringi-requests/submit/route"
import budgetHandler from "@/app/department-budgets/route"
import budgetListHandler from "@/app/department-budgets/list/route"
import budgetShowHandler from "@/app/department-budgets/show/[budget_id]/route"
import budgetSummaryHandler from "@/app/department-budgets/summary/route"
import budgetCreateHandler from "@/app/department-budgets/create/route"
import budgetUpdateHandler from "@/app/department-budgets/update/[budget_id]/route"
import budgetDeleteHandler from "@/app/department-budgets/delete/[budget_id]/route"
import goalCreateHandler from "@/app/performance-goals/create/route"
import goalEvaluateHandler from "@/app/performance-goals/evaluate/[goal_id]/route"
import goalHandler from "@/app/performance-goals/route"
import goalListHandler from "@/app/performance-goals/list/route"
import goalTreeHandler from "@/app/performance-goals/tree/route"
import gradesHandler from "@/app/grade-definitions/route"
import gradesListHandler from "@/app/grade-definitions/list/route"
import gradesCreateHandler from "@/app/grade-definitions/create/route"
import gradesUpdateHandler from "@/app/grade-definitions/update/route"
import gradesDeleteHandler from "@/app/grade-definitions/delete/route"
import gradesAssignmentsHandler from "@/app/employee-grades/list/route"
import gradesAssignHandler from "@/app/employee-grades/create/route"
import positionsHandler from "@/app/position-definitions/route"
import positionsListHandler from "@/app/position-definitions/list/route"
import positionsCreateHandler from "@/app/position-definitions/create/route"
import positionsUpdateHandler from "@/app/position-definitions/update/route"
import positionsDeleteHandler from "@/app/position-definitions/delete/route"
import employeeEventsHandler from "@/app/employee-events/route"
import employeeEventsListHandler from "@/app/employee-events/list/route"
import employeeEventsRecordHandler from "@/app/employee-events/record/route"
import kbGetHandler from "@/app/knowledge-articles/get/[kid]/route"
import kbHandler from "@/app/knowledge-articles/route"
import kbSearchHandler from "@/app/knowledge-articles/search/route"
import leaveApproveHandler from "@/app/leave-requests/approve/[leave_id]/route"
import leaveBalanceHandler from "@/app/leave-requests/balance/route"
import leaveHandler from "@/app/leave-requests/route"
import leaveInboxHandler from "@/app/leave-requests/inbox/route"
import leaveMineHandler from "@/app/leave-requests/mine/route"
import leaveRejectHandler from "@/app/leave-requests/reject/[leave_id]/route"
import leaveRequestHandler from "@/app/leave-requests/request/route"
import loginHandler from "@/app/login/route"
import bootstrapHandler from "@/app/bootstrap/route"
import notifyCountHandler from "@/app/notifications/count/route"
import notifyHandler from "@/app/notifications/route"
import notifyListHandler from "@/app/notifications/list/route"
import notifyReadAllHandler from "@/app/notifications/read-all/route"
import notifyReadHandler from "@/app/notifications/read/[notification_id]/route"
import notifySendHandler from "@/app/notifications/send/route"
import onboardingAssignHandler from "@/app/onboarding-assignments/create/[employee_code]/route"
import onboardingCompleteHandler from "@/app/onboarding-tasks/complete/[task_id]/route"
import onboardingAssignmentsRootHandler from "@/app/onboarding-assignments/route"
import onboardingTasksRootHandler from "@/app/onboarding-tasks/route"
import onboardingTemplatesRootHandler from "@/app/onboarding-templates/route"
import onboardingMeHandler from "@/app/onboarding-assignments/me/route"
import rolesHandler from "@/app/roles/route"
import accountsHandler from "@/app/accounts/route"
import onboardingShowHandler from "@/app/onboarding-assignments/employees/[employee_code]/route"
import onboardingTemplatesHandler from "@/app/onboarding-templates/list/route"
import oneononeCreateHandler from "@/app/one-on-ones/create/route"
import oneononeHandler from "@/app/one-on-ones/route"
import oneononeListHandler from "@/app/one-on-ones/list/route"
import thanksHandler from "@/app/thanks-messages/route"
import thanksListHandler from "@/app/thanks-messages/list/route"
import thanksSendHandler from "@/app/thanks-messages/send/route"
import thanksBudgetHandler from "@/app/thanks-point-budgets/me/route"
import thanksBalanceHandler from "@/app/thanks-point-balances/me/route"
import thanksRewardsHandler from "@/app/thanks-rewards/list/route"
import thanksRewardAddHandler from "@/app/thanks-rewards/create/route"
import thanksRedeemHandler from "@/app/thanks-redemptions/create/route"
import thanksRedemptionsHandler from "@/app/thanks-redemptions/list/route"
import thanksRedemptionApproveHandler from "@/app/thanks-redemptions/approve/[redemption_id]/route"
import thanksRedemptionRejectHandler from "@/app/thanks-redemptions/reject/[redemption_id]/route"
import orgHandler from "@/app/departments/route"
import orgLineHandler from "@/app/employees/reporting-line/[employee_code]/route"
import orgMembersHandler from "@/app/departments/members/[dept_code]/route"
import orgTreeHandler from "@/app/departments/tree/route"
import reviewCycleCreateHandler from "@/app/review-cycles/create/route"
import reviewCycleHandler from "@/app/review-cycles/route"
import reviewCyclesHandler from "@/app/review-cycles/list/route"
import reviewCyclesRootHandler from "@/app/review-cycles/route"
import reviewFormsRootHandler from "@/app/review-forms/route"
import reviewMineHandler from "@/app/review-forms/mine/route"
import reviewFormsHandler from "@/app/review-forms/list/route"
import reviewFormsBulkHandler from "@/app/review-forms/bulk/route"
import reviewDiscloseHandler from "@/app/review-cycles/disclose/route"
import reviewResultsHandler from "@/app/review-cycles/results/[cycle_id]/[employee_code]/route"
import reviewSubmitHandler from "@/app/review-forms/submit/[form_id]/route"
import roomAvailHandler from "@/app/rooms/availability/route"
import roomCancelHandler from "@/app/room-reservations/cancel/route"
import roomHandler from "@/app/rooms/route"
import roomMineHandler from "@/app/room-reservations/mine/route"
import roomReserveHandler from "@/app/room-reservations/create/route"
import roomShowHandler from "@/app/room-reservations/show/route"
import roomUpdateHandler from "@/app/room-reservations/update/route"
import shiftAssignHandler from "@/app/shift-assignments/create/route"
import shiftAssignmentsHandler from "@/app/shift-assignments/list/route"
import shiftAssignmentsRootHandler from "@/app/shift-assignments/route"
import shiftPatternsRootHandler from "@/app/shift-patterns/route"
import shiftSwapRequestsRootHandler from "@/app/shift-swap-requests/route"
import shiftMineHandler from "@/app/shift-assignments/mine/route"
import shiftPatternCreateHandler from "@/app/shift-patterns/create/route"
import shiftPatternsHandler from "@/app/shift-patterns/list/route"
import shiftPublishHandler from "@/app/shift-assignments/publish/[id]/route"
import shiftSwapApproveHandler from "@/app/shift-swap-requests/approve/[id]/route"
import shiftSwapHandler from "@/app/shift-swap-requests/create/route"
import skillHandler from "@/app/skill-definitions/route"
import skillListHandler from "@/app/skill-definitions/list/route"
import skillMineHandler from "@/app/employee-skills/me/route"
import skillSetHandler from "@/app/employee-skills/set/[skill_code]/route"
import surveyAnswerHandler from "@/app/surveys/answer/[survey_id]/route"
import surveyHandler from "@/app/surveys/route"
import surveyListHandler from "@/app/surveys/list/route"
import surveySummaryHandler from "@/app/surveys/summary/[survey_id]/route"
import certificationsHandler from "@/app/certification-definitions/route"
import certificationsCreateHandler from "@/app/certification-definitions/create/route"
import certificationsUpdateHandler from "@/app/certification-definitions/update/[id]/route"
import certificationsRecordsHandler from "@/app/certification-definitions/records/route"
import certificationsRecordAddHandler from "@/app/certification-definitions/record-add/route"
import certificationsRecordRemoveHandler from "@/app/certification-definitions/record-remove/[id]/route"
import healthCheckupsHandler from "@/app/health-checkups/route"
import healthCheckupsCreateHandler from "@/app/health-checkups/create/route"
import healthCheckupsCompleteHandler from "@/app/health-checkups/complete/[id]/route"
import workAccidentsHandler from "@/app/work-accidents/route"
import workAccidentsCreateHandler from "@/app/work-accidents/create/route"
import workAccidentsCloseHandler from "@/app/work-accidents/close/[id]/route"
import trainingCompleteHandler from "@/app/training-enrollments/complete/[id]/route"
import trainingCourseHandler from "@/app/training-courses/show/[code]/route"
import trainingCourseCreateHandler from "@/app/training-courses/create/route"
import trainingCoursesHandler from "@/app/training-courses/list/route"
import trainingEnrollHandler from "@/app/training-enrollments/create/route"
import trainingEnrollmentsHandler from "@/app/training-enrollments/list/route"
import trainingCoursesRootHandler from "@/app/training-courses/route"
import trainingEnrollmentsRootHandler from "@/app/training-enrollments/route"
import trainingMineHandler from "@/app/training-enrollments/mine/route"
import whoamiHandler from "@/app/whoami/route"
import governanceHandler from "@/app/governance-documents/route"
import governanceAcknowledgeHandler from "@/app/governance-documents/acknowledge/[code]/route"
import governanceAssignRoleHandler from "@/app/governance-org-roles/assign/[code]/route"
import governanceImpactHandler from "@/app/governance-documents/impact/route"
import governanceListHandler from "@/app/governance-documents/list/route"
import governanceOrgRolesHandler from "@/app/governance-org-roles/list/route"
import governancePublishHandler from "@/app/governance-documents/publish/[code]/route"
import governanceReviewHandler from "@/app/governance-documents/review/[code]/route"
import governanceRevokeRoleHandler from "@/app/governance-org-roles/revoke/[assignment_id]/route"
import governanceShowHandler from "@/app/governance-documents/show/[code]/route"
import governanceSubmitReviewHandler from "@/app/governance-documents/submit-review/[code]/route"
import governanceSyncHandler from "@/app/governance-documents/sync/route"
import businessTripHandler from "@/app/business-trips/route"
import businessTripRequestHandler from "@/app/business-trips/request/route"
import businessTripMineHandler from "@/app/business-trips/mine/route"
import businessTripAdminHandler from "@/app/business-trips/admin/route"
import businessTripShowHandler from "@/app/business-trips/show/route"
import businessTripUpdateHandler from "@/app/business-trips/update/route"
import businessTripCancelHandler from "@/app/business-trips/cancel/route"
import businessTripApproveHandler from "@/app/business-trips/approve/route"
import businessTripRejectHandler from "@/app/business-trips/reject/route"
import rentalHandler from "@/app/rental-reservations/route"
import rentalReserveHandler from "@/app/rental-reservations/reserve/route"
import rentalMineHandler from "@/app/rental-reservations/mine/route"
import rentalAdminHandler from "@/app/rental-reservations/admin/route"
import rentalShowHandler from "@/app/rental-reservations/show/route"
import rentalUpdateHandler from "@/app/rental-reservations/update/route"
import rentalCancelHandler from "@/app/rental-reservations/cancel/route"
import rentalLendHandler from "@/app/rental-reservations/lend/route"
import rentalReturnHandler from "@/app/rental-reservations/return/route"
import resignationHandler from "@/app/resignations/route"
import resignationRequestHandler from "@/app/resignations/request/route"
import resignationMineHandler from "@/app/resignations/mine/route"
import resignationAdminHandler from "@/app/resignations/admin/route"
import resignationShowHandler from "@/app/resignations/show/route"
import resignationUpdateHandler from "@/app/resignations/update/route"
import resignationCancelHandler from "@/app/resignations/cancel/route"
import resignationAcceptHandler from "@/app/resignations/accept/route"
import resignationRejectHandler from "@/app/resignations/reject/route"
import lifeEventHandler from "@/app/life-events/route"
import lifeEventRequestHandler from "@/app/life-events/request/route"
import lifeEventMineHandler from "@/app/life-events/mine/route"
import lifeEventAdminHandler from "@/app/life-events/admin/route"
import lifeEventShowHandler from "@/app/life-events/show/route"
import lifeEventUpdateHandler from "@/app/life-events/update/route"
import lifeEventCancelHandler from "@/app/life-events/cancel/route"
import lifeEventApproveHandler from "@/app/life-events/approve/route"
import lifeEventRejectHandler from "@/app/life-events/reject/route"
import familyCareLeaveHandler from "@/app/family-care-leaves/route"
import familyCareLeaveRequestHandler from "@/app/family-care-leaves/request/route"
import familyCareLeaveMineHandler from "@/app/family-care-leaves/mine/route"
import familyCareLeaveAdminHandler from "@/app/family-care-leaves/admin/route"
import familyCareLeaveShowHandler from "@/app/family-care-leaves/show/route"
import familyCareLeaveUpdateHandler from "@/app/family-care-leaves/update/route"
import familyCareLeaveCancelHandler from "@/app/family-care-leaves/cancel/route"
import familyCareLeaveApproveHandler from "@/app/family-care-leaves/approve/route"
import familyCareLeaveCancelApprovalHandler from "@/app/family-care-leaves/cancel-approval/route"
import certificateRequestHandler from "@/app/certificate-requests/route"
import certificateRequestRequestHandler from "@/app/certificate-requests/request/route"
import certificateRequestMineHandler from "@/app/certificate-requests/mine/route"
import certificateRequestAdminHandler from "@/app/certificate-requests/admin/route"
import certificateRequestShowHandler from "@/app/certificate-requests/show/route"
import certificateRequestUpdateHandler from "@/app/certificate-requests/update/route"
import certificateRequestCancelHandler from "@/app/certificate-requests/cancel/route"
import certificateRequestIssueHandler from "@/app/certificate-requests/issue/route"
import certificateRequestRejectHandler from "@/app/certificate-requests/reject/route"
import antisocialCheckHandler from "@/app/antisocial-checks/route"
import antisocialCheckRequestHandler from "@/app/antisocial-checks/request/route"
import antisocialCheckMineHandler from "@/app/antisocial-checks/mine/route"
import antisocialCheckShowHandler from "@/app/antisocial-checks/show/route"
import antisocialCheckUpdateHandler from "@/app/antisocial-checks/update/route"
import antisocialCheckCancelHandler from "@/app/antisocial-checks/cancel/route"
import appTemplateCreateHandler from "@/app/application-requests/template-create/route"
import appTemplateUpdateHandler from "@/app/application-requests/template-update/route"
import appTemplateDeleteHandler from "@/app/application-requests/template-delete/route"
import appWorkflowHandler from "@/app/application-requests/workflow/[code]/route"
import appWorkflowRepairListHandler from "@/app/application-requests/workflow-repair/list/route"
import appWorkflowRepairReassignHandler from "@/app/application-requests/workflow-repair/reassign/[app_id]/route"
import appResubmitHandler from "@/app/application-requests/resubmit/[app_id]/route"
import appDelegationsHandler from "@/app/application-requests/delegations/route"
import appDelegateHandler from "@/app/application-requests/delegate/route"
import appDelegationDeleteHandler from "@/app/application-requests/delegation-delete/[id]/route"
import reviewCyclePolicyHandler from "@/app/review-cycles/policy/route"
import roomsListHandler from "@/app/rooms/list/route"
import roomsShowHandler from "@/app/rooms/show/[room_id]/route"
import roomsCreateHandler from "@/app/rooms/create/route"
import roomsUpdateHandler from "@/app/rooms/update/[room_id]/route"
import roomsDeleteHandler from "@/app/rooms/delete/[room_id]/route"
import surveyCreateHandler from "@/app/surveys/create/route"
import surveyUpdateHandler from "@/app/surveys/survey-update/[survey_id]/route"
import surveyDeleteHandler from "@/app/surveys/survey-delete/[survey_id]/route"
import careerPostingShowHandler from "@/app/career-postings/show/[posting_id]/route"
import careerPostingCreateHandler from "@/app/career-postings/create/route"
import careerPostingUpdateHandler from "@/app/career-postings/update/route"
import careerPostingDeleteHandler from "@/app/career-postings/delete/route"
import onboardingTemplateCreateHandler from "@/app/onboarding-templates/create/route"
import onboardingTemplateUpdateHandler from "@/app/onboarding-templates/update/route"
import onboardingTemplateDeleteHandler from "@/app/onboarding-templates/delete/route"
import onboardingTemplateBindLifecycleHandler from "@/app/onboarding-templates/bind-lifecycle/[template_code]/route"
import onboardingTemplateUnbindLifecycleHandler from "@/app/onboarding-templates/unbind-lifecycle/[template_code]/route"
import onboardingTemplateShowHandler from "@/app/onboarding-templates/show/[code]/route"
import reviewCycleUpdateHandler from "@/app/review-cycles/update/route"
import reviewCycleDeleteHandler from "@/app/review-cycles/delete/route"
import reviewCycleOpenHandler from "@/app/review-cycles/open/route"
import reviewCycleCloseHandler from "@/app/review-cycles/close/route"
import cmd1on1DeleteHandler from "@/app/one-on-ones/delete/route"
import cmd1on1EditHandler from "@/app/one-on-ones/edit/route"
import cmd1on1MineHandler from "@/app/one-on-ones/mine/route"
import cmd1on1ShowHandler from "@/app/one-on-ones/show/route"
import appUpdateHandler from "@/app/application-requests/update/[app_id]/route"
import appWithdrawHandler from "@/app/application-requests/withdraw/[app_id]/route"
import thanksPointBudgetsRootHandler from "@/app/thanks-point-budgets/route"
import thanksPointBalancesRootHandler from "@/app/thanks-point-balances/route"
import governanceOrgRolesRootHandler from "@/app/governance-org-roles/route"
import employeeSkillsRootHandler from "@/app/employee-skills/route"
import employeeGradesRootHandler from "@/app/employee-grades/route"
import roomReservationsRootHandler from "@/app/room-reservations/route"
import thanksRewardsRootHandler from "@/app/thanks-rewards/route"
import thanksRedemptionsRootHandler from "@/app/thanks-redemptions/route"
import assetDeleteHandler from "@/app/assets/delete/[asset_code]/route"
import assetUpdateHandler from "@/app/assets/update/[asset_code]/route"
import assetDisposeHandler from "@/app/assets/dispose/[asset_code]/route"
import assetHoldingsHandler from "@/app/assets/holdings/route"
import stocktakeHandler from "@/app/stocktakes/route"
import stocktakeListHandler from "@/app/stocktakes/list/route"
import stocktakeStartHandler from "@/app/stocktakes/start/route"
import stocktakeShowHandler from "@/app/stocktakes/show/[stocktake_id]/route"
import stocktakeCheckHandler from "@/app/stocktakes/check/[stocktake_id]/route"
import stocktakeCloseHandler from "@/app/stocktakes/close/[stocktake_id]/route"
import careerApplicationShowHandler from "@/app/career-applications/show/route"
import careerApplicationUpdateHandler from "@/app/career-applications/update/route"
import careerApplicationsHandler from "@/app/career-applications/list/route"
import careerSheetDeleteHandler from "@/app/career-sheets/delete/route"
import careerWithdrawHandler from "@/app/career-applications/withdraw/route"
import employeeDeleteHandler from "@/app/employees/delete/[employee_code]/route"
import employeeRegisterHandler from "@/app/employees/register/route"
import employeeShowHandler from "@/app/employees/show/[employee_code]/route"
import employeeUpdateHandler from "@/app/employees/update/[employee_code]/route"
import employeeTimelineHandler from "@/app/employees/timeline/route"
import employeeStateHandler from "@/app/employees/state/route"
import employeeArchiveHandler from "@/app/employees/archive/route"
import personnelActionRequestHandler from "@/app/personnel-actions/request/route"
import personnelActionApplyHandler from "@/app/personnel-actions/apply/route"
import personnelActionCorrectHandler from "@/app/personnel-actions/correct/route"
import lifecyclePreflightHandler from "@/app/batch/employee-lifecycle/preflight/route"
import lifecycleBackfillHandler from "@/app/batch/employee-lifecycle/backfill/route"
import lifecycleVerifyHandler from "@/app/batch/employee-lifecycle/verify/route"
import lifecycleRebuildHandler from "@/app/batch/employee-lifecycle/rebuild-projections/route"
import lifecycleOutboxHandler from "@/app/batch/employee-lifecycle/process-outbox/route"
import expenseDeleteHandler from "@/app/expenses/delete/[expense_id]/route"
import expenseUpdateHandler from "@/app/expenses/update/[expense_id]/route"
import goalDeleteHandler from "@/app/performance-goals/delete/route"
import goalMineHandler from "@/app/performance-goals/mine/route"
import goalShowHandler from "@/app/performance-goals/show/route"
import goalUpdateHandler from "@/app/performance-goals/update/route"
import kbAddHandler from "@/app/knowledge-articles/add/route"
import kbDeleteHandler from "@/app/knowledge-articles/delete/route"
import kbEditHandler from "@/app/knowledge-articles/edit/route"
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
import documentsHandler from "@/app/document-ledger-entries/route"
import documentsListHandler from "@/app/document-ledger-entries/list/route"
import documentsRegisterHandler from "@/app/document-ledger-entries/register/route"
import documentsUpdateHandler from "@/app/document-ledger-entries/update/[document_id]/route"
import leaveCancelHandler from "@/app/leave-requests/cancel/route"
import leaveShowHandler from "@/app/leave-requests/show/route"
import leaveUpdateHandler from "@/app/leave-requests/update/route"
import notifyDeleteHandler from "@/app/notifications/delete/route"
import notifyShowHandler from "@/app/notifications/show/route"
import onboardingAssignmentCancelHandler from "@/app/onboarding-assignments/cancel/[assignment_id]/route"
import onboardingAssignmentShowHandler from "@/app/onboarding-assignments/show/[assignment_id]/route"
import onboardingAssignmentUpdateHandler from "@/app/onboarding-assignments/update/[assignment_id]/route"
import onboardingUncompleteHandler from "@/app/onboarding-tasks/uncomplete/[task_id]/route"
import orgDeptCreateHandler from "@/app/departments/create/route"
import orgDeptDeleteHandler from "@/app/departments/delete/route"
import orgDeptListHandler from "@/app/departments/list/route"
import orgDeptShowHandler from "@/app/departments/show/route"
import orgDeptUpdateHandler from "@/app/departments/update/route"
import shiftAssignmentDeleteHandler from "@/app/shift-assignments/delete/route"
import shiftAssignmentShowHandler from "@/app/shift-assignments/show/route"
import shiftAssignmentUpdateHandler from "@/app/shift-assignments/update/route"
import shiftPatternDeleteHandler from "@/app/shift-patterns/delete/route"
import shiftPatternShowHandler from "@/app/shift-patterns/show/route"
import shiftPatternUpdateHandler from "@/app/shift-patterns/update/route"
import shiftSwapCancelHandler from "@/app/shift-swap-requests/cancel/route"
import shiftSwapMineHandler from "@/app/shift-swap-requests/mine/route"
import shiftSwapShowHandler from "@/app/shift-swap-requests/show/route"
import skillRemoveHandler from "@/app/employee-skills/remove/[skill_code]/route"
import skillShowHandler from "@/app/skill-definitions/show/[skill_code]/route"
import surveyEditHandler from "@/app/surveys/edit/[response_id]/route"
import surveyResponseHandler from "@/app/surveys/response/[response_id]/route"
import surveyResponsesHandler from "@/app/surveys/responses/route"
import surveyWithdrawHandler from "@/app/surveys/withdraw/[response_id]/route"
import trainingCancelHandler from "@/app/training-enrollments/cancel/route"
import trainingCourseArchiveHandler from "@/app/training-courses/archive/route"
import trainingCourseUpdateHandler from "@/app/training-courses/update/route"
import trainingRescheduleHandler from "@/app/training-enrollments/reschedule/route"
import trainingShowHandler from "@/app/training-enrollments/show/route"
import meetingsHandler from "@/app/meetings/route"
import meetingsListHandler from "@/app/meetings/list/route"
import meetingsShowHandler from "@/app/meetings/show/[code]/route"
import meetingsCreateHandler from "@/app/meetings/create/route"
import meetingsUpdateHandler from "@/app/meetings/update/[code]/route"
import meetingsArchiveHandler from "@/app/meetings/archive/[code]/route"
import minutesHandler from "@/app/meeting-minutes-records/route"
import minutesListHandler from "@/app/meeting-minutes-records/list/[meeting_code]/route"
import minutesShowHandler from "@/app/meeting-minutes-records/show/[id]/route"
import minutesAddHandler from "@/app/meeting-minutes-records/add/[meeting_code]/route"
import minutesEditHandler from "@/app/meeting-minutes-records/edit/[id]/route"
import decisionsHandler from "@/app/decision-records/route"
import decisionsListHandler from "@/app/decision-records/list/route"
import decisionsShowHandler from "@/app/decision-records/show/[id]/route"
import decisionsCreateHandler from "@/app/decision-records/create/route"
import decisionsUpdateHandler from "@/app/decision-records/update/[id]/route"
import decisionsSupersedeHandler from "@/app/decision-records/supersede/[id]/route"
import jobOpeningsRootHandler from "@/app/job-openings/route"
import recruitmentCandidatesRootHandler from "@/app/recruitment-candidates/route"
import recruitmentPositionsHandler from "@/app/job-openings/list/route"
import recruitmentPositionCreateHandler from "@/app/job-openings/create/route"
import recruitmentPositionUpdateHandler from "@/app/job-openings/update/[id]/route"
import recruitmentCandidatesHandler from "@/app/recruitment-candidates/list/[position_id]/route"
import recruitmentCandidateAddHandler from "@/app/recruitment-candidates/create/[position_id]/route"
import recruitmentAdvanceHandler from "@/app/recruitment-candidates/advance/[id]/route"
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
import licensesHandler from "@/app/software-licenses/route"
import licensesListHandler from "@/app/software-licenses/list/route"
import licensesCreateHandler from "@/app/software-licenses/create/route"
import licensesUpdateHandler from "@/app/software-licenses/update/[license_id]/route"
import licensesCancelHandler from "@/app/software-licenses/cancel/[license_id]/route"
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

routes.post("/governance-documents", ...governanceHandler)
routes.post("/governance-documents/list", ...governanceListHandler)
routes.post("/governance-documents/show/:code?", ...governanceShowHandler)
routes.post("/governance-documents/sync", ...governanceSyncHandler)
routes.post("/governance-documents/impact", ...governanceImpactHandler)
routes.post("/governance-documents/submit-review/:code?", ...governanceSubmitReviewHandler)
routes.post("/governance-documents/review/:code?", ...governanceReviewHandler)
routes.post("/governance-documents/publish/:code?", ...governancePublishHandler)
routes.post("/governance-documents/acknowledge/:code?", ...governanceAcknowledgeHandler)
routes.post("/governance-org-roles/list", ...governanceOrgRolesHandler)
routes.post("/governance-org-roles/assign/:code?", ...governanceAssignRoleHandler)
routes.post("/governance-org-roles/revoke/:assignment_id?", ...governanceRevokeRoleHandler)

routes.post("/employees", ...employeeHandler)
routes.post("/employees/search", ...employeeSearchHandler)

routes.post("/application-requests", ...appHandler)
routes.post("/application-requests/templates", ...appTemplatesHandler)
routes.post("/application-requests/template/:code?", ...appTemplateHandler)
routes.post("/application-requests/submit/:template_code?", ...appSubmitHandler)
routes.post("/application-requests/inbox", ...appInboxHandler)
routes.post("/application-requests/mine", ...appMineHandler)
routes.post("/application-requests/show/:app_id?", ...appShowHandler)
routes.post("/application-requests/approve/:app_id?", ...appApproveHandler)
routes.post("/application-requests/reject/:app_id?", ...appRejectHandler)

routes.post("/knowledge-articles", ...kbHandler)
routes.post("/knowledge-articles/search", ...kbSearchHandler)
routes.post("/knowledge-articles/search/:q", ...kbSearchHandler)
routes.post("/knowledge-articles/get/:kid?", ...kbGetHandler)

routes.post("/thanks-point-budgets", ...thanksPointBudgetsRootHandler)
routes.post("/thanks-point-balances", ...thanksPointBalancesRootHandler)
routes.post("/governance-org-roles", ...governanceOrgRolesRootHandler)
routes.post("/employee-skills", ...employeeSkillsRootHandler)
routes.post("/employee-grades", ...employeeGradesRootHandler)
routes.post("/room-reservations", ...roomReservationsRootHandler)
routes.post("/rooms", ...roomHandler)
routes.post("/rooms/availability", ...roomAvailHandler)
routes.post("/room-reservations/create", ...roomReserveHandler)
routes.post("/room-reservations/mine", ...roomMineHandler)
routes.post("/room-reservations/show", ...roomShowHandler)
routes.post("/room-reservations/update", ...roomUpdateHandler)
routes.post("/room-reservations/cancel", ...roomCancelHandler)

routes.post("/skill-definitions", ...skillHandler)
routes.post("/skill-definitions/list", ...skillListHandler)
routes.post("/employee-skills/me", ...skillMineHandler)
routes.post("/employee-skills/set/:skill_code?", ...skillSetHandler)

routes.post("/expenses", ...expenseHandler)
routes.post("/expenses/submit", ...expenseSubmitHandler)
routes.post("/expenses/mine", ...expenseMineHandler)
routes.post("/expenses/inbox", ...expenseInboxHandler)
routes.post("/expenses/show/:expense_id?", ...expenseShowHandler)
routes.post("/expenses/approve/:expense_id?", ...expenseApproveHandler)
routes.post("/expenses/reject/:expense_id?", ...expenseRejectHandler)
routes.post("/department-budgets", ...budgetHandler)
routes.post("/department-budgets/list", ...budgetListHandler)
routes.post("/department-budgets/summary", ...budgetSummaryHandler)
routes.post("/department-budgets/create", ...budgetCreateHandler)
routes.post("/department-budgets/show/:budget_id?", ...budgetShowHandler)
routes.post("/department-budgets/update/:budget_id?", ...budgetUpdateHandler)
routes.post("/department-budgets/delete/:budget_id?", ...budgetDeleteHandler)

routes.post("/ringi-requests", ...ringiHandler)
routes.post("/ringi-requests/submit", ...ringiSubmitHandler)
routes.post("/ringi-requests/me", ...ringiMeHandler)
routes.post("/ringi-requests/inbox", ...ringiInboxHandler)
routes.post("/ringi-requests/approve/:ringi_id?", ...ringiApproveHandler)
routes.post("/ringi-requests/reject/:ringi_id?", ...ringiRejectHandler)
routes.post("/ringi-requests/admin", ...ringiAdminHandler)

routes.post("/performance-goals", ...goalHandler)
routes.post("/performance-goals/list", ...goalListHandler)
routes.post("/performance-goals/tree", ...goalTreeHandler)
routes.post("/performance-goals/create", ...goalCreateHandler)
routes.post("/performance-goals/evaluate/:goal_id?", ...goalEvaluateHandler)

routes.post("/grade-definitions", ...gradesHandler)
routes.post("/grade-definitions/list", ...gradesListHandler)
routes.post("/grade-definitions/create", ...gradesCreateHandler)
routes.post("/grade-definitions/update", ...gradesUpdateHandler)
routes.post("/grade-definitions/delete", ...gradesDeleteHandler)
routes.post("/employee-grades/list", ...gradesAssignmentsHandler)
routes.post("/employee-grades/create", ...gradesAssignHandler)
routes.post("/position-definitions", ...positionsHandler)
routes.post("/position-definitions/list", ...positionsListHandler)
routes.post("/position-definitions/create", ...positionsCreateHandler)
routes.post("/position-definitions/update", ...positionsUpdateHandler)
routes.post("/position-definitions/delete", ...positionsDeleteHandler)

routes.post("/employee-events", ...employeeEventsHandler)
routes.post("/employee-events/list", ...employeeEventsListHandler)
routes.post("/employee-events/record", ...employeeEventsRecordHandler)

routes.post("/one-on-ones", ...oneononeHandler)
routes.post("/one-on-ones/list", ...oneononeListHandler)
routes.post("/one-on-ones/create", ...oneononeCreateHandler)

routes.post("/thanks-messages", ...thanksHandler)
routes.post("/thanks-messages/list", ...thanksListHandler)
routes.post("/thanks-messages/send", ...thanksSendHandler)
routes.post("/thanks-point-budgets/me", ...thanksBudgetHandler)
routes.post("/thanks-point-balances/me", ...thanksBalanceHandler)
routes.post("/thanks-rewards", ...thanksRewardsRootHandler)
routes.post("/thanks-redemptions", ...thanksRedemptionsRootHandler)
routes.post("/thanks-rewards/list", ...thanksRewardsHandler)
routes.post("/thanks-rewards/create", ...thanksRewardAddHandler)
routes.post("/thanks-redemptions/create", ...thanksRedeemHandler)
routes.post("/thanks-redemptions/list", ...thanksRedemptionsHandler)
routes.post("/thanks-redemptions/approve/:redemption_id?", ...thanksRedemptionApproveHandler)
routes.post("/thanks-redemptions/reject/:redemption_id?", ...thanksRedemptionRejectHandler)

routes.post("/surveys", ...surveyHandler)
routes.post("/surveys/list", ...surveyListHandler)
routes.post("/surveys/answer/:survey_id?", ...surveyAnswerHandler)
routes.post("/surveys/summary/:survey_id?", ...surveySummaryHandler)

routes.post("/career-applications", ...careerApplicationsRootHandler)
routes.post("/career-postings", ...careerPostingsRootHandler)
routes.post("/career-sheets", ...careerSheetsRootHandler)
routes.post("/career-sheets/show", ...careerSheetHandler)
routes.post("/career-sheets/update", ...careerSheetUpdateHandler)
routes.post("/career-postings/list", ...careerPostingsHandler)
routes.post("/career-applications/create/:posting_id?", ...careerApplyHandler)

routes.post("/assets", ...assetHandler)
routes.post("/assets/list", ...assetListHandler)
routes.post("/assets/lent/me", ...assetMineHandler)
routes.post("/assets/show/:asset_code?", ...assetShowHandler)
routes.post("/assets/register", ...assetRegisterHandler)
routes.post("/assets/lend/:asset_code?", ...assetLendHandler)
routes.post("/assets/return/:asset_code?", ...assetReturnHandler)
routes.post("/assets/dispose/:asset_code?", ...assetDisposeHandler)
routes.post("/assets/holdings", ...assetHoldingsHandler)

routes.post("/stocktakes", ...stocktakeHandler)
routes.post("/stocktakes/list", ...stocktakeListHandler)
routes.post("/stocktakes/start", ...stocktakeStartHandler)
routes.post("/stocktakes/show/:stocktake_id?", ...stocktakeShowHandler)
routes.post("/stocktakes/check/:stocktake_id?", ...stocktakeCheckHandler)
routes.post("/stocktakes/close/:stocktake_id?", ...stocktakeCloseHandler)

routes.post("/partners", ...partnersHandler)
routes.post("/partners/list", ...partnersListHandler)
routes.post("/partners/show/:partner_code?", ...partnersShowHandler)
routes.post("/partners/register", ...partnersRegisterHandler)
routes.post("/partners/update/:partner_id?", ...partnersUpdateHandler)
routes.post("/partners/archive/:partner_id?", ...partnersArchiveHandler)

routes.post("/partner-contracts", ...contractsHandler)
routes.post("/partner-contracts/list", ...contractsListHandler)
routes.post("/partner-contracts/create", ...contractsCreateHandler)
routes.post("/partner-contracts/update/:contract_id?", ...contractsUpdateHandler)

routes.post("/notifications", ...notifyHandler)
routes.post("/notifications/list", ...notifyListHandler)
routes.post("/notifications/count", ...notifyCountHandler)
routes.post("/notifications/read-all", ...notifyReadAllHandler)
routes.post("/notifications/read/:notification_id?", ...notifyReadHandler)
routes.post("/notifications/send", ...notifySendHandler)

routes.post("/attendance-records", ...attendanceHandler)
routes.post("/attendance-records/clock-in", ...attendanceClockInHandler)
routes.post("/attendance-records/clock-out", ...attendanceClockOutHandler)
routes.post("/attendance-records/me", ...attendanceMeHandler)
routes.post("/attendance-records/summary", ...attendanceSummaryHandler)
routes.post("/attendance-records/list", ...attendanceListHandler)
routes.post("/attendance-records/overtime", ...attendanceOvertimeHandler)

routes.post("/company-calendar-days", ...calendarHandler)
routes.post("/company-calendar-days/list", ...calendarListHandler)
routes.post("/company-calendar-days/add", ...calendarAddHandler)
routes.post("/company-calendar-days/delete", ...calendarDeleteHandler)

routes.post("/employee-work-styles", ...workStylesHandler)
routes.post("/employee-work-styles/list", ...workStylesListHandler)
routes.post("/employee-work-styles/add", ...workStylesAddHandler)

routes.post("/leave-requests", ...leaveHandler)
routes.post("/leave-requests/balance", ...leaveBalanceHandler)
routes.post("/leave-requests/request", ...leaveRequestHandler)
routes.post("/leave-requests/mine", ...leaveMineHandler)
routes.post("/leave-requests/inbox", ...leaveInboxHandler)
routes.post("/leave-requests/approve/:leave_id?", ...leaveApproveHandler)
routes.post("/leave-requests/reject/:leave_id?", ...leaveRejectHandler)

routes.post("/departments", ...orgHandler)
routes.post("/departments/tree", ...orgTreeHandler)
routes.post("/departments/members/:dept_code?", ...orgMembersHandler)
routes.post("/employees/reporting-line/:employee_code?", ...orgLineHandler)

routes.post("/onboarding-assignments", ...onboardingAssignmentsRootHandler)
routes.post("/onboarding-tasks", ...onboardingTasksRootHandler)
routes.post("/onboarding-templates", ...onboardingTemplatesRootHandler)
routes.post("/onboarding-templates/list", ...onboardingTemplatesHandler)
routes.post("/onboarding-assignments/create/:employee_code?", ...onboardingAssignHandler)
routes.post("/onboarding-assignments/me", ...onboardingMeHandler)
routes.post("/roles", ...rolesHandler)
routes.post("/accounts", ...accountsHandler)
routes.post("/onboarding-tasks/complete/:task_id?", ...onboardingCompleteHandler)
routes.post("/onboarding-assignments/employees/:employee_code?", ...onboardingShowHandler)

routes.post("/review-cycles", ...reviewCyclesRootHandler)
routes.post("/review-forms", ...reviewFormsRootHandler)
routes.post("/review-cycles/list", ...reviewCyclesHandler)
routes.post("/review-cycles", ...reviewCycleHandler)
routes.post("/review-cycles/create", ...reviewCycleCreateHandler)
routes.post("/review-forms/mine", ...reviewMineHandler)
routes.post("/review-forms/list", ...reviewFormsHandler)
routes.post("/review-forms/bulk", ...reviewFormsBulkHandler)
routes.post("/review-cycles/disclose", ...reviewDiscloseHandler)
routes.post("/review-forms/submit/:form_id?", ...reviewSubmitHandler)
routes.post("/review-cycles/results/:cycle_id?/:employee_code?", ...reviewResultsHandler)

routes.post("/training-courses", ...trainingCoursesRootHandler)
routes.post("/training-enrollments", ...trainingEnrollmentsRootHandler)
routes.post("/training-courses/list", ...trainingCoursesHandler)
routes.post("/training-courses/show/:code?", ...trainingCourseHandler)
routes.post("/training-courses/create", ...trainingCourseCreateHandler)
routes.post("/training-enrollments/list", ...trainingEnrollmentsHandler)
routes.post("/training-enrollments/mine", ...trainingMineHandler)
routes.post("/training-enrollments/create", ...trainingEnrollHandler)
routes.post("/training-enrollments/complete/:id?", ...trainingCompleteHandler)

routes.post("/shift-assignments", ...shiftAssignmentsRootHandler)
routes.post("/shift-patterns", ...shiftPatternsRootHandler)
routes.post("/shift-swap-requests", ...shiftSwapRequestsRootHandler)
routes.post("/shift-assignments/list", ...shiftAssignmentsHandler)
routes.post("/shift-assignments/mine", ...shiftMineHandler)
routes.post("/shift-assignments/create", ...shiftAssignHandler)
routes.post("/shift-assignments/publish/:id?", ...shiftPublishHandler)
routes.post("/shift-patterns/list", ...shiftPatternsHandler)
routes.post("/shift-patterns/create", ...shiftPatternCreateHandler)
routes.post("/shift-swap-requests/create", ...shiftSwapHandler)
routes.post("/shift-swap-requests/approve/:id?", ...shiftSwapApproveHandler)

routes.post("/batch", ...batchHandler)
routes.post("/batch/migrate-password-hashes", ...batchMigratePasswordHashesHandler)
routes.post("/dashboard", ...dashboardHandler)
routes.post("/dashboard/management", ...dashboardManagementHandler)
routes.post("/business-trips", ...businessTripHandler)
routes.post("/business-trips/request", ...businessTripRequestHandler)
routes.post("/business-trips/mine", ...businessTripMineHandler)
routes.post("/business-trips/admin", ...businessTripAdminHandler)
routes.post("/business-trips/show", ...businessTripShowHandler)
routes.post("/business-trips/update", ...businessTripUpdateHandler)
routes.post("/business-trips/cancel", ...businessTripCancelHandler)
routes.post("/business-trips/approve", ...businessTripApproveHandler)
routes.post("/business-trips/reject", ...businessTripRejectHandler)
routes.post("/certification-definitions", ...certificationsHandler)
routes.post("/certification-definitions/create", ...certificationsCreateHandler)
routes.post("/certification-definitions/update/:id?", ...certificationsUpdateHandler)
routes.post("/certification-definitions/records", ...certificationsRecordsHandler)
routes.post("/certification-definitions/record-add", ...certificationsRecordAddHandler)
routes.post("/certification-definitions/record-remove/:id?", ...certificationsRecordRemoveHandler)

routes.post("/health-checkups", ...healthCheckupsHandler)
routes.post("/health-checkups/create", ...healthCheckupsCreateHandler)
routes.post("/health-checkups/complete/:id?", ...healthCheckupsCompleteHandler)

routes.post("/work-accidents", ...workAccidentsHandler)
routes.post("/work-accidents/create", ...workAccidentsCreateHandler)
routes.post("/work-accidents/close/:id?", ...workAccidentsCloseHandler)

routes.post("/rental-reservations", ...rentalHandler)
routes.post("/rental-reservations/reserve", ...rentalReserveHandler)
routes.post("/rental-reservations/mine", ...rentalMineHandler)
routes.post("/rental-reservations/admin", ...rentalAdminHandler)
routes.post("/rental-reservations/show", ...rentalShowHandler)
routes.post("/rental-reservations/update", ...rentalUpdateHandler)
routes.post("/rental-reservations/cancel", ...rentalCancelHandler)
routes.post("/rental-reservations/lend", ...rentalLendHandler)
routes.post("/rental-reservations/return", ...rentalReturnHandler)
routes.post("/resignations", ...resignationHandler)
routes.post("/resignations/request", ...resignationRequestHandler)
routes.post("/resignations/mine", ...resignationMineHandler)
routes.post("/resignations/admin", ...resignationAdminHandler)
routes.post("/resignations/show", ...resignationShowHandler)
routes.post("/resignations/update", ...resignationUpdateHandler)
routes.post("/resignations/cancel", ...resignationCancelHandler)
routes.post("/resignations/accept", ...resignationAcceptHandler)
routes.post("/resignations/reject", ...resignationRejectHandler)
routes.post("/life-events", ...lifeEventHandler)
routes.post("/life-events/request", ...lifeEventRequestHandler)
routes.post("/life-events/mine", ...lifeEventMineHandler)
routes.post("/life-events/admin", ...lifeEventAdminHandler)
routes.post("/life-events/show", ...lifeEventShowHandler)
routes.post("/life-events/update", ...lifeEventUpdateHandler)
routes.post("/life-events/cancel", ...lifeEventCancelHandler)
routes.post("/life-events/approve", ...lifeEventApproveHandler)
routes.post("/life-events/reject", ...lifeEventRejectHandler)
routes.post("/family-care-leaves", ...familyCareLeaveHandler)
routes.post("/family-care-leaves/request", ...familyCareLeaveRequestHandler)
routes.post("/family-care-leaves/mine", ...familyCareLeaveMineHandler)
routes.post("/family-care-leaves/admin", ...familyCareLeaveAdminHandler)
routes.post("/family-care-leaves/show", ...familyCareLeaveShowHandler)
routes.post("/family-care-leaves/update", ...familyCareLeaveUpdateHandler)
routes.post("/family-care-leaves/cancel", ...familyCareLeaveCancelHandler)
routes.post("/family-care-leaves/approve", ...familyCareLeaveApproveHandler)
routes.post("/family-care-leaves/cancel-approval", ...familyCareLeaveCancelApprovalHandler)
routes.post("/certificate-requests", ...certificateRequestHandler)
routes.post("/certificate-requests/request", ...certificateRequestRequestHandler)
routes.post("/certificate-requests/mine", ...certificateRequestMineHandler)
routes.post("/certificate-requests/admin", ...certificateRequestAdminHandler)
routes.post("/certificate-requests/show", ...certificateRequestShowHandler)
routes.post("/certificate-requests/update", ...certificateRequestUpdateHandler)
routes.post("/certificate-requests/cancel", ...certificateRequestCancelHandler)
routes.post("/certificate-requests/issue", ...certificateRequestIssueHandler)
routes.post("/certificate-requests/reject", ...certificateRequestRejectHandler)
routes.post("/antisocial-checks", ...antisocialCheckHandler)
routes.post("/antisocial-checks/request", ...antisocialCheckRequestHandler)
routes.post("/antisocial-checks/mine", ...antisocialCheckMineHandler)
routes.post("/antisocial-checks/show", ...antisocialCheckShowHandler)
routes.post("/antisocial-checks/update", ...antisocialCheckUpdateHandler)
routes.post("/antisocial-checks/cancel", ...antisocialCheckCancelHandler)
routes.post("/application-requests/template-create", ...appTemplateCreateHandler)
routes.post("/application-requests/template-update", ...appTemplateUpdateHandler)
routes.post("/application-requests/template-delete", ...appTemplateDeleteHandler)
routes.post("/application-requests/workflow/:code?", ...appWorkflowHandler)
routes.post("/application-requests/workflow-repair/list", ...appWorkflowRepairListHandler)
routes.post(
  "/application-requests/workflow-repair/reassign/:app_id?",
  ...appWorkflowRepairReassignHandler,
)
routes.post("/application-requests/resubmit/:app_id?", ...appResubmitHandler)
routes.post("/application-requests/update/:app_id?", ...appUpdateHandler)
routes.post("/application-requests/withdraw/:app_id?", ...appWithdrawHandler)
routes.post("/application-requests/delegations", ...appDelegationsHandler)
routes.post("/application-requests/delegate", ...appDelegateHandler)
routes.post("/application-requests/delegation-delete/:id?", ...appDelegationDeleteHandler)
routes.post("/review-cycles/policy", ...reviewCyclePolicyHandler)
routes.post("/rooms/list", ...roomsListHandler)
routes.post("/rooms/create", ...roomsCreateHandler)
routes.post("/rooms/show/:room_id?", ...roomsShowHandler)
routes.post("/rooms/update/:room_id?", ...roomsUpdateHandler)
routes.post("/rooms/delete/:room_id?", ...roomsDeleteHandler)
routes.post("/surveys/create", ...surveyCreateHandler)
routes.post("/surveys/survey-update/:survey_id?", ...surveyUpdateHandler)
routes.post("/surveys/survey-delete/:survey_id?", ...surveyDeleteHandler)
routes.post("/career-postings/create", ...careerPostingCreateHandler)
routes.post("/career-postings/update", ...careerPostingUpdateHandler)
routes.post("/career-postings/delete", ...careerPostingDeleteHandler)
routes.post("/career-postings/show/:posting_id?", ...careerPostingShowHandler)
routes.post("/onboarding-templates/create", ...onboardingTemplateCreateHandler)
routes.post("/onboarding-templates/update", ...onboardingTemplateUpdateHandler)
routes.post("/onboarding-templates/delete", ...onboardingTemplateDeleteHandler)
routes.post(
  "/onboarding-templates/bind-lifecycle/:template_code?",
  ...onboardingTemplateBindLifecycleHandler,
)
routes.post(
  "/onboarding-templates/unbind-lifecycle/:template_code?",
  ...onboardingTemplateUnbindLifecycleHandler,
)
routes.post("/onboarding-templates/show/:code?", ...onboardingTemplateShowHandler)
routes.post("/review-cycles/update", ...reviewCycleUpdateHandler)
routes.post("/review-cycles/delete", ...reviewCycleDeleteHandler)
routes.post("/review-cycles/open", ...reviewCycleOpenHandler)
routes.post("/review-cycles/close", ...reviewCycleCloseHandler)

routes.post("/one-on-ones/delete", ...cmd1on1DeleteHandler)
routes.post("/one-on-ones/edit", ...cmd1on1EditHandler)
routes.post("/one-on-ones/mine", ...cmd1on1MineHandler)
routes.post("/one-on-ones/show", ...cmd1on1ShowHandler)
routes.post("/assets/delete/:asset_code?", ...assetDeleteHandler)
routes.post("/assets/update/:asset_code?", ...assetUpdateHandler)
routes.post("/career-applications/show", ...careerApplicationShowHandler)
routes.post("/career-applications/update", ...careerApplicationUpdateHandler)
routes.post("/career-applications/list", ...careerApplicationsHandler)
routes.post("/career-sheets/delete", ...careerSheetDeleteHandler)
routes.post("/career-applications/withdraw", ...careerWithdrawHandler)
routes.post("/employees/delete/:employee_code?", ...employeeDeleteHandler)
routes.post("/employees/register", ...employeeRegisterHandler)
routes.post("/employees/show/:employee_code?", ...employeeShowHandler)
routes.post("/employees/update/:employee_code?", ...employeeUpdateHandler)
routes.post("/employees/timeline", ...employeeTimelineHandler)
routes.post("/employees/state", ...employeeStateHandler)
routes.post("/employees/archive", ...employeeArchiveHandler)
routes.post("/personnel-actions/request", ...personnelActionRequestHandler)
routes.post("/personnel-actions/apply", ...personnelActionApplyHandler)
routes.post("/personnel-actions/correct", ...personnelActionCorrectHandler)
routes.post("/batch/employee-lifecycle/preflight", ...lifecyclePreflightHandler)
routes.post("/batch/employee-lifecycle/backfill", ...lifecycleBackfillHandler)
routes.post("/batch/employee-lifecycle/verify", ...lifecycleVerifyHandler)
routes.post("/batch/employee-lifecycle/rebuild-projections", ...lifecycleRebuildHandler)
routes.post("/batch/employee-lifecycle/process-outbox", ...lifecycleOutboxHandler)
routes.post("/expenses/delete/:expense_id?", ...expenseDeleteHandler)
routes.post("/expenses/update/:expense_id?", ...expenseUpdateHandler)
routes.post("/performance-goals/delete", ...goalDeleteHandler)
routes.post("/performance-goals/mine", ...goalMineHandler)
routes.post("/performance-goals/show", ...goalShowHandler)
routes.post("/performance-goals/update", ...goalUpdateHandler)
routes.post("/knowledge-articles/add", ...kbAddHandler)
routes.post("/knowledge-articles/delete", ...kbDeleteHandler)
routes.post("/knowledge-articles/edit", ...kbEditHandler)
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
routes.post("/document-ledger-entries", ...documentsHandler)
routes.post("/document-ledger-entries/list", ...documentsListHandler)
routes.post("/document-ledger-entries/register", ...documentsRegisterHandler)
routes.post("/document-ledger-entries/update/:document_id?", ...documentsUpdateHandler)
routes.post("/leave-requests/cancel", ...leaveCancelHandler)
routes.post("/leave-requests/show", ...leaveShowHandler)
routes.post("/leave-requests/update", ...leaveUpdateHandler)
routes.post("/notifications/delete", ...notifyDeleteHandler)
routes.post("/notifications/show", ...notifyShowHandler)
routes.post("/onboarding-assignments/cancel/:assignment_id?", ...onboardingAssignmentCancelHandler)
routes.post("/onboarding-assignments/show/:assignment_id?", ...onboardingAssignmentShowHandler)
routes.post("/onboarding-assignments/update/:assignment_id?", ...onboardingAssignmentUpdateHandler)
routes.post("/onboarding-tasks/uncomplete/:task_id?", ...onboardingUncompleteHandler)
routes.post("/departments/create", ...orgDeptCreateHandler)
routes.post("/departments/delete", ...orgDeptDeleteHandler)
routes.post("/departments/list", ...orgDeptListHandler)
routes.post("/departments/show", ...orgDeptShowHandler)
routes.post("/departments/update", ...orgDeptUpdateHandler)
routes.post("/shift-assignments/delete", ...shiftAssignmentDeleteHandler)
routes.post("/shift-assignments/show", ...shiftAssignmentShowHandler)
routes.post("/shift-assignments/update", ...shiftAssignmentUpdateHandler)
routes.post("/shift-patterns/delete", ...shiftPatternDeleteHandler)
routes.post("/shift-patterns/show", ...shiftPatternShowHandler)
routes.post("/shift-patterns/update", ...shiftPatternUpdateHandler)
routes.post("/shift-swap-requests/cancel", ...shiftSwapCancelHandler)
routes.post("/shift-swap-requests/mine", ...shiftSwapMineHandler)
routes.post("/shift-swap-requests/show", ...shiftSwapShowHandler)
routes.post("/employee-skills/remove/:skill_code?", ...skillRemoveHandler)
routes.post("/skill-definitions/show/:skill_code?", ...skillShowHandler)
routes.post("/surveys/edit/:response_id?", ...surveyEditHandler)
routes.post("/surveys/response/:response_id?", ...surveyResponseHandler)
routes.post("/surveys/responses", ...surveyResponsesHandler)
routes.post("/surveys/withdraw/:response_id?", ...surveyWithdrawHandler)
routes.post("/training-enrollments/cancel", ...trainingCancelHandler)
routes.post("/training-courses/archive", ...trainingCourseArchiveHandler)
routes.post("/training-courses/update", ...trainingCourseUpdateHandler)
routes.post("/training-enrollments/reschedule", ...trainingRescheduleHandler)
routes.post("/training-enrollments/show", ...trainingShowHandler)
routes.post("/meetings", ...meetingsHandler)
routes.post("/meetings/list", ...meetingsListHandler)
routes.post("/meetings/show/:code?", ...meetingsShowHandler)
routes.post("/meetings/create", ...meetingsCreateHandler)
routes.post("/meetings/update/:code?", ...meetingsUpdateHandler)
routes.post("/meetings/archive/:code?", ...meetingsArchiveHandler)
routes.post("/meeting-minutes-records", ...minutesHandler)
routes.post("/meeting-minutes-records/list/:meeting_code?", ...minutesListHandler)
routes.post("/meeting-minutes-records/show/:id?", ...minutesShowHandler)
routes.post("/meeting-minutes-records/add/:meeting_code?", ...minutesAddHandler)
routes.post("/meeting-minutes-records/edit/:id?", ...minutesEditHandler)
routes.post("/decision-records", ...decisionsHandler)
routes.post("/decision-records/list", ...decisionsListHandler)
routes.post("/decision-records/show/:id?", ...decisionsShowHandler)
routes.post("/decision-records/create", ...decisionsCreateHandler)
routes.post("/decision-records/update/:id?", ...decisionsUpdateHandler)
routes.post("/decision-records/supersede/:id?", ...decisionsSupersedeHandler)
routes.post("/job-openings", ...jobOpeningsRootHandler)
routes.post("/recruitment-candidates", ...recruitmentCandidatesRootHandler)
routes.post("/job-openings/list", ...recruitmentPositionsHandler)
routes.post("/job-openings/create", ...recruitmentPositionCreateHandler)
routes.post("/job-openings/update/:id?", ...recruitmentPositionUpdateHandler)
routes.post("/recruitment-candidates/list/:position_id?", ...recruitmentCandidatesHandler)
routes.post("/recruitment-candidates/create/:position_id?", ...recruitmentCandidateAddHandler)
routes.post("/recruitment-candidates/advance/:id?", ...recruitmentAdvanceHandler)
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
routes.post("/software-licenses", ...licensesHandler)
routes.post("/software-licenses/list", ...licensesListHandler)
routes.post("/software-licenses/create", ...licensesCreateHandler)
routes.post("/software-licenses/update/:license_id?", ...licensesUpdateHandler)
routes.post("/software-licenses/cancel/:license_id?", ...licensesCancelHandler)
routes.post("/it-incidents", ...itIncidentsHandler)
routes.post("/it-incidents/list", ...itIncidentsListHandler)
routes.post("/it-incidents/create", ...itIncidentsCreateHandler)
routes.post("/it-incidents/resolve/:incident_id?", ...itIncidentsResolveHandler)
routes.post("/salary-revisions", ...salaryRevisionsHandler)
routes.post("/salary-revisions/list", ...salaryRevisionsListHandler)
routes.post("/salary-revisions/create", ...salaryRevisionsCreateHandler)

export const app = routes
