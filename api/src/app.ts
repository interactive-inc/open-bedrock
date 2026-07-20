import { hc } from "hono/client"
import { HTTPException } from "hono/http-exception"
import { bodyLimit } from "hono/body-limit"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { contextStorage } from "hono/context-storage"
import { databaseMiddleware } from "@/interface/middleware/database-middleware"
import { rateLimitMiddleware } from "@/interface/middleware/rate-limit-middleware"
import { requestContextMiddleware } from "@/interface/middleware/request-context-middleware"
import { factory } from "@/lib/factory"
import { auditNoStore } from "@/interface/utils/audit-route-contract"
import * as auditEventExportsRoute from "@/interface/routes/audit-event-exports/route"
import * as auditEventDetailRoute from "@/interface/routes/audit-events/[event_id]/route"
import * as auditEventsRoute from "@/interface/routes/audit-events/route"
import * as applicationAdminRoute from "@/interface/routes/applications/admin/route"
import * as applicationApproveRoute from "@/interface/routes/applications/[id]/approve/route"
import * as applicationDetailRoute from "@/interface/routes/applications/[id]/route"
import * as applicationInboxRoute from "@/interface/routes/applications/inbox/route"
import * as applicationWorkflowRepairsRoute from "@/interface/routes/applications/workflow-repairs/route"
import * as applicationReassignWorkflowStepRoute from "@/interface/routes/applications/[id]/reassign-workflow-step/route"
import * as applicationListRoute from "@/interface/routes/applications/route"
import * as applicationRejectRoute from "@/interface/routes/applications/[id]/reject/route"
import * as applicationResubmitRoute from "@/interface/routes/applications/[id]/resubmit/route"
import * as applicationSubmitRoute from "@/interface/routes/applications/submit-route"
import * as applicationTemplateDetailRoute from "@/interface/routes/application-templates/[code]/route"
import * as applicationTemplateWorkflowRoute from "@/interface/routes/application-templates/[code]/workflow/route"
import * as approvalDelegationsRoute from "@/interface/routes/approval-delegations/route"
import * as approvalDelegationDetailRoute from "@/interface/routes/approval-delegations/[id]/route"
import * as applicationTemplateListRoute from "@/interface/routes/application-templates/route"
import * as assetDetailRoute from "@/interface/routes/assets/[code]/route"
import * as assetDisposeRoute from "@/interface/routes/assets/[code]/dispose/route"
import * as assetHoldingsRoute from "@/interface/routes/assets/holdings/route"
import * as assetLendRoute from "@/interface/routes/assets/[code]/lend/route"
import * as assetLentMeRoute from "@/interface/routes/assets/lent/me/route"
import * as assetListRoute from "@/interface/routes/assets/route"
import * as assetRegisterRoute from "@/interface/routes/assets/register-route"
import * as assetReturnRoute from "@/interface/routes/assets/[code]/return/route"
import * as partnerListRoute from "@/interface/routes/partners/route"
import * as partnerDetailRoute from "@/interface/routes/partners/[code]/route"
import * as partnerUpdateRoute from "@/interface/routes/partners/[id]/route"
import * as partnerArchiveRoute from "@/interface/routes/partners/[id]/archive/route"
import * as contractListRoute from "@/interface/routes/contracts/route"
import * as contractDetailRoute from "@/interface/routes/contracts/[id]/route"
import * as stocktakeCheckRoute from "@/interface/routes/stocktakes/[id]/assets/[code]/check/route"
import * as stocktakeCloseRoute from "@/interface/routes/stocktakes/[id]/close/route"
import * as stocktakeDetailRoute from "@/interface/routes/stocktakes/[id]/route"
import * as stocktakeListRoute from "@/interface/routes/stocktakes/route"
import * as attendanceClockInRoute from "@/interface/routes/attendance/clock-in/route"
import * as attendanceClockOutRoute from "@/interface/routes/attendance/clock-out/route"
import * as attendanceListRoute from "@/interface/routes/attendance/route"
import * as attendanceMeRoute from "@/interface/routes/attendance/me/route"
import * as attendanceMeSummaryRoute from "@/interface/routes/attendance/me/summary/route"
import * as attendanceOvertimeSummaryRoute from "@/interface/routes/attendance/overtime-summary/route"
import * as calendarListRoute from "@/interface/routes/calendar/route"
import * as calendarDayCreateRoute from "@/interface/routes/calendar/days/create-route"
import * as calendarDayDetailRoute from "@/interface/routes/calendar/days/[id]/route"
import * as workStyleRoute from "@/interface/routes/work-styles/route"
import * as authLoginRoute from "@/interface/routes/auth/login/route"
import * as authLogoutRoute from "@/interface/routes/auth/logout/route"
import * as authMeRoute from "@/interface/routes/me/route"
import * as authRefreshRoute from "@/interface/routes/auth/refresh/route"
import * as meDepartmentsRoute from "@/interface/routes/me/departments/route"
import * as meReportsRoute from "@/interface/routes/me/reports/route"
import * as batchMigratePasswordHashesRoute from "@/interface/routes/batch/migrate-password-hashes/route"
import * as batchRoute from "@/interface/routes/batch/route"
import * as lifecycleMigrationPreflightRoute from "@/interface/routes/batch/employee-lifecycle/preflight/route"
import * as lifecycleMigrationBackfillRoute from "@/interface/routes/batch/employee-lifecycle/backfill/route"
import * as lifecycleMigrationVerifyRoute from "@/interface/routes/batch/employee-lifecycle/verify/route"
import * as lifecycleProjectionRebuildRoute from "@/interface/routes/batch/employee-lifecycle/rebuild-projections/route"
import * as businessTripCreateRoute from "@/interface/routes/business-trips/route"
import * as businessTripDetailRoute from "@/interface/routes/business-trips/[id]/route"
import * as businessTripMineRoute from "@/interface/routes/business-trips/me/route"
import * as businessTripAdminRoute from "@/interface/routes/business-trips/admin/route"
import * as businessTripApproveRoute from "@/interface/routes/business-trips/[id]/approve/route"
import * as businessTripRejectRoute from "@/interface/routes/business-trips/[id]/reject/route"
import * as certificationListRoute from "@/interface/routes/certifications/route"
import * as certificationDetailRoute from "@/interface/routes/certifications/[id]/route"
import * as employeeCertificationListRoute from "@/interface/routes/employee-certifications/route"
import * as employeeCertificationDetailRoute from "@/interface/routes/employee-certifications/[id]/route"
import * as healthCheckupListRoute from "@/interface/routes/health-checkups/route"
import * as healthCheckupCompleteRoute from "@/interface/routes/health-checkups/[id]/complete/route"
import * as workAccidentListRoute from "@/interface/routes/work-accidents/route"
import * as workAccidentCloseRoute from "@/interface/routes/work-accidents/[id]/close/route"
import * as rentalReservationCreateRoute from "@/interface/routes/rentals/route"
import * as rentalReservationDetailRoute from "@/interface/routes/rentals/[id]/route"
import * as rentalReservationMineRoute from "@/interface/routes/rentals/me/route"
import * as rentalReservationAdminRoute from "@/interface/routes/rentals/admin/route"
import * as rentalReservationLendRoute from "@/interface/routes/rentals/[id]/lend/route"
import * as rentalReservationReturnRoute from "@/interface/routes/rentals/[id]/return/route"
import * as ringiAdminRoute from "@/interface/routes/ringi/admin/route"
import * as ringiApproveRoute from "@/interface/routes/ringi/[id]/approve/route"
import * as ringiCreateRoute from "@/interface/routes/ringi/route"
import * as ringiInboxRoute from "@/interface/routes/ringi/inbox/route"
import * as ringiMeRoute from "@/interface/routes/ringi/me/route"
import * as ringiRejectRoute from "@/interface/routes/ringi/[id]/reject/route"
import * as careerPostingApplyRoute from "@/interface/routes/career/postings/[posting_id]/apply/route"
import * as careerPostingDetailRoute from "@/interface/routes/career/postings/[posting_id]/route"
import * as careerPostingListRoute from "@/interface/routes/career/postings/route"
import * as careerSheetMeRoute from "@/interface/routes/career/sheet/me/route"
import * as careerSheetMeUpdateRoute from "@/interface/routes/career/sheet/me/update-route"
import * as dashboardRoute from "@/interface/routes/dashboard/route"
import * as dashboardManagementRoute from "@/interface/routes/dashboard/management/route"
import * as inboxCountsRoute from "@/interface/routes/inbox/counts/route"
import * as employeeListRoute from "@/interface/routes/employees/route"
import * as employeeDirectoryRoute from "@/interface/routes/directory/employees/route"
import * as employeeLifecycleEventsRoute from "@/interface/routes/employees/[code]/lifecycle-events/route"
import * as employeeLifecycleStateRoute from "@/interface/routes/employees/[code]/lifecycle-state/route"
import * as employeeArchiveRoute from "@/interface/routes/employees/[code]/archive/route"
import * as lifecycleOutboxRoute from "@/interface/routes/batch/employee-lifecycle/process-outbox/route"
import * as personnelActionsRoute from "@/interface/routes/personnel-actions/route"
import * as personnelActionCorrectionRoute from "@/interface/routes/personnel-actions/[id]/correct/route"
import * as personnelActionRequestsRoute from "@/interface/routes/personnel-action-requests/route"
import * as personnelActionRequestDetailRoute from "@/interface/routes/personnel-action-requests/[id]/route"
import * as expenseAdminRoute from "@/interface/routes/expenses/admin/route"
import * as expenseApproveRoute from "@/interface/routes/expenses/[id]/approve/route"
import * as expenseCreateRoute from "@/interface/routes/expenses/route"
import * as expenseDetailRoute from "@/interface/routes/expenses/[id]/route"
import * as expenseInboxRoute from "@/interface/routes/expenses/inbox/route"
import * as expenseMeRoute from "@/interface/routes/expenses/me/route"
import * as expenseRejectRoute from "@/interface/routes/expenses/[id]/reject/route"
import * as budgetListRoute from "@/interface/routes/budgets/route"
import * as budgetSummaryRoute from "@/interface/routes/budgets/summary/route"
import * as budgetDetailRoute from "@/interface/routes/budgets/[id]/route"
import * as goalCreateRoute from "@/interface/routes/goals/create-route"
import * as goalEvaluationCreateRoute from "@/interface/routes/goals/[goal_id]/evaluations/route"
import * as goalListRoute from "@/interface/routes/goals/route"
import * as goalTreeRoute from "@/interface/routes/goals/tree/route"
import * as gradeCreateRoute from "@/interface/routes/grades/create-route"
import * as gradeDetailRoute from "@/interface/routes/grades/[id]/route"
import * as gradeAssignmentsRoute from "@/interface/routes/grades/assignments/route"
import * as gradeListRoute from "@/interface/routes/grades/route"
import * as positionCreateRoute from "@/interface/routes/positions/create-route"
import * as positionDetailRoute from "@/interface/routes/positions/[id]/route"
import * as positionListRoute from "@/interface/routes/positions/route"
import * as employeeEventsRoute from "@/interface/routes/employee-events/route"
import * as governanceCapabilitiesRoute from "@/interface/routes/governance/capabilities/route"
import * as governanceDocumentDetailRoute from "@/interface/routes/governance/documents/[code]/route"
import * as governanceDocumentAcknowledgeRoute from "@/interface/routes/governance/documents/[code]/acknowledge/route"
import * as governanceDocumentPublishRoute from "@/interface/routes/governance/documents/[code]/versions/[version]/publish/route"
import * as governanceDocumentReviewRoute from "@/interface/routes/governance/documents/[code]/versions/[version]/review/route"
import * as governanceDocumentSubmitReviewRoute from "@/interface/routes/governance/documents/[code]/versions/[version]/submit-review/route"
import * as governanceDocumentsRoute from "@/interface/routes/governance/documents/route"
import * as governanceDocumentSyncRoute from "@/interface/routes/governance/documents/sync/route"
import * as governanceImpactRoute from "@/interface/routes/governance/impact/route"
import * as governanceOrgRolesRoute from "@/interface/routes/governance/org-roles/route"
import * as governanceOrgRoleAssignmentsRoute from "@/interface/routes/governance/org-roles/[code]/assignments/route"
import * as governanceOrgRoleAssignmentDetailRoute from "@/interface/routes/governance/org-roles/assignments/[id]/route"
import * as knowledgeDetailRoute from "@/interface/routes/knowledge/[id]/route"
import * as knowledgeListRoute from "@/interface/routes/knowledge/route"
import * as announcementListRoute from "@/interface/routes/announcements/route"
import * as announcementDetailRoute from "@/interface/routes/announcements/[id]/route"
import * as announcementPublishRoute from "@/interface/routes/announcements/[id]/publish/route"
import * as announcementArchiveRoute from "@/interface/routes/announcements/[id]/archive/route"
import * as regulationListRoute from "@/interface/routes/regulations/route"
import * as regulationDetailRoute from "@/interface/routes/regulations/[code]/route"
import * as regulationVersionsRoute from "@/interface/routes/regulations/[code]/versions/route"
import * as regulationArchiveRoute from "@/interface/routes/regulations/[code]/archive/route"
import * as documentListRoute from "@/interface/routes/documents/route"
import * as documentDetailRoute from "@/interface/routes/documents/[id]/route"
import * as leaveBalanceMeRoute from "@/interface/routes/leave/balance/me/route"
import * as leaveBalanceRoute from "@/interface/routes/leave/balance/route"
import * as leaveRequestAdminRoute from "@/interface/routes/leave/requests/admin/route"
import * as leaveRequestApproveRoute from "@/interface/routes/leave/requests/[id]/approve/route"
import * as leaveRequestCreateRoute from "@/interface/routes/leave/requests/route"
import * as leaveRequestInboxRoute from "@/interface/routes/leave/requests/inbox/route"
import * as leaveRequestMeRoute from "@/interface/routes/leave/requests/me/route"
import * as leaveRequestRejectRoute from "@/interface/routes/leave/requests/[id]/reject/route"
import * as notificationCreateRoute from "@/interface/routes/notifications/route"
import * as notificationMeRoute from "@/interface/routes/notifications/me/route"
import * as notificationMeUnreadCountRoute from "@/interface/routes/notifications/me/unread-count/route"
import * as notificationReadAllRoute from "@/interface/routes/notifications/read-all/route"
import * as notificationReadRoute from "@/interface/routes/notifications/[id]/read/route"
import * as onboardingAssignRoute from "@/interface/routes/onboarding/assign/route"
import * as onboardingEmployeeRoute from "@/interface/routes/onboarding/employee/[code]/route"
import * as onboardingMeRoute from "@/interface/routes/onboarding/me/route"
import * as onboardingTaskCompleteRoute from "@/interface/routes/onboarding/tasks/[id]/complete/route"
import * as onboardingTemplateListRoute from "@/interface/routes/onboarding/templates/route"
import * as oneOnOneRoute from "@/interface/routes/oneonones/route"
import * as thanksRoute from "@/interface/routes/thanks/route"
import * as thanksBudgetMeRoute from "@/interface/routes/thanks/budget/me/route"
import * as thanksBalanceMeRoute from "@/interface/routes/thanks/balance/me/route"
import * as thanksRewardsRoute from "@/interface/routes/thanks/rewards/route"
import * as thanksRewardDetailRoute from "@/interface/routes/thanks/rewards/[id]/route"
import * as thanksRedemptionsRoute from "@/interface/routes/thanks/redemptions/route"
import * as thanksRedemptionsAdminRoute from "@/interface/routes/thanks/redemptions/admin/route"
import * as thanksRedemptionsMeRoute from "@/interface/routes/thanks/redemptions/me/route"
import * as thanksRedemptionsInboxRoute from "@/interface/routes/thanks/redemptions/inbox/route"
import * as thanksRedemptionApproveRoute from "@/interface/routes/thanks/redemptions/[id]/approve/route"
import * as thanksRedemptionRejectRoute from "@/interface/routes/thanks/redemptions/[id]/reject/route"
import * as orgDepartmentMembersRoute from "@/interface/routes/org/departments/[code]/members/route"
import * as orgReportingLineRoute from "@/interface/routes/org/reporting-line/[employee_code]/route"
import * as orgTreeRoute from "@/interface/routes/org/tree/route"
import * as reviewCycleCloseRoute from "@/interface/routes/review-cycles/[cycle_id]/close/route"
import * as reviewCycleCreateRoute from "@/interface/routes/review-cycles/create-route"
import * as reviewCycleDiscloseRoute from "@/interface/routes/review-cycles/[cycle_id]/disclose/route"
import * as reviewCycleFormsBulkRoute from "@/interface/routes/review-cycles/[cycle_id]/forms/bulk/route"
import * as reviewFormsRoute from "@/interface/routes/review-forms/route"
import * as reviewCycleListRoute from "@/interface/routes/review-cycles/route"
import * as reviewCycleOpenRoute from "@/interface/routes/review-cycles/[cycle_id]/open/route"
import * as reviewCycleResultsRoute from "@/interface/routes/review-cycles/[cycle_id]/results/[employee_code]/route"
import * as reviewCyclePolicyRoute from "@/interface/routes/review-cycles/[cycle_id]/policy/route"
import * as reviewFormMeRoute from "@/interface/routes/review-forms/me/route"
import * as reviewFormSubmitRoute from "@/interface/routes/review-forms/[form_id]/submit/route"
import * as roomAvailabilityRoute from "@/interface/routes/rooms/availability/route"
import * as roomReservationCreateRoute from "@/interface/routes/rooms/reservations/route"
import * as roomReservationDetailRoute from "@/interface/routes/rooms/reservations/[id]/route"
import * as roomReservationMineRoute from "@/interface/routes/rooms/reservations/me/route"
import * as shiftAssignmentCreateRoute from "@/interface/routes/shift/assignments/create-route"
import * as shiftAssignmentListRoute from "@/interface/routes/shift/assignments/route"
import * as shiftAssignmentMeRoute from "@/interface/routes/shift/assignments/me/route"
import * as shiftAssignmentPublishRoute from "@/interface/routes/shift/assignments/[id]/publish/route"
import * as shiftPatternCreateRoute from "@/interface/routes/shift/patterns/create-route"
import * as shiftPatternListRoute from "@/interface/routes/shift/patterns/route"
import * as shiftSwapRequestAdminRoute from "@/interface/routes/shift/swap-requests/admin/route"
import * as shiftSwapRequestApproveRoute from "@/interface/routes/shift/swap-requests/[id]/approve/route"
import * as shiftSwapRequestRoute from "@/interface/routes/shift/swap-requests/route"
import * as skillListRoute from "@/interface/routes/skills/route"
import * as skillMeRoute from "@/interface/routes/skills/me/route"
import * as skillMeUpdateRoute from "@/interface/routes/skills/me/update-route"
import * as surveyListRoute from "@/interface/routes/surveys/route"
import * as surveyResponseCreateRoute from "@/interface/routes/surveys/[survey_id]/responses/route"
import * as surveySummaryRoute from "@/interface/routes/surveys/[survey_id]/summary/route"
import * as trainingCourseCreateRoute from "@/interface/routes/training/courses/create-route"
import * as trainingCourseDetailRoute from "@/interface/routes/training/courses/[code]/route"
import * as trainingCourseListRoute from "@/interface/routes/training/courses/route"
import * as trainingEnrollmentCompleteRoute from "@/interface/routes/training/enrollments/[id]/complete/route"
import * as trainingEnrollmentCreateRoute from "@/interface/routes/training/enrollments/enroll-route"
import * as trainingEnrollmentListRoute from "@/interface/routes/training/enrollments/route"
import * as trainingEnrollmentMeRoute from "@/interface/routes/training/enrollments/me/route"
import * as applicationApplicationsMeRoute from "@/interface/routes/applications/me/route"
import * as careerApplicationsIdRoute from "@/interface/routes/career/applications/[id]/route"
import * as careerApplicationsMeRoute from "@/interface/routes/career/applications/me/route"
import * as employeeCodeRoute from "@/interface/routes/employees/[code]/route"
import * as goalGoalsGoalIdRoute from "@/interface/routes/goals/[goal_id]/route"
import * as goalGoalsMeRoute from "@/interface/routes/goals/me/route"
import * as leaveRequestsIdRoute from "@/interface/routes/leave/requests/[id]/route"
import * as notificationIdRoute from "@/interface/routes/notifications/[id]/route"
import * as onboardingAssignmentsIdRoute from "@/interface/routes/onboarding/assignments/[id]/route"
import * as onboardingTasksIdUncompleteRoute from "@/interface/routes/onboarding/tasks/[id]/uncomplete/route"
import * as oneononeIdRoute from "@/interface/routes/oneonones/[id]/route"
import * as oneononeMeRoute from "@/interface/routes/oneonones/me/route"
import * as orgDepartmentsCodeRoute from "@/interface/routes/org/departments/[code]/route"
import * as orgDepartmentsRoute from "@/interface/routes/org/departments/route"
import * as shiftAssignmentsIdRoute from "@/interface/routes/shift/assignments/[id]/route"
import * as shiftPatternsIdRoute from "@/interface/routes/shift/patterns/[id]/route"
import * as shiftSwapRequestsIdRoute from "@/interface/routes/shift/swap-requests/[id]/route"
import * as shiftSwapRequestsMeRoute from "@/interface/routes/shift/swap-requests/me/route"
import * as skillSkillsMeSkillCodeRoute from "@/interface/routes/skills/me/[skill_code]/route"
import * as surveySurveysResponsesResponseIdRoute from "@/interface/routes/surveys/responses/[response_id]/route"
import * as surveySurveysResponsesMeRoute from "@/interface/routes/surveys/responses/me/route"
import * as trainingEnrollmentsIdRoute from "@/interface/routes/training/enrollments/[id]/route"
import * as resignationCreateRoute from "@/interface/routes/resignations/route"
import * as resignationDetailRoute from "@/interface/routes/resignations/[id]/route"
import * as resignationMineRoute from "@/interface/routes/resignations/me/route"
import * as resignationAdminRoute from "@/interface/routes/resignations/admin/route"
import * as resignationAcceptRoute from "@/interface/routes/resignations/[id]/accept/route"
import * as resignationRejectRoute from "@/interface/routes/resignations/[id]/reject/route"
import * as lifeEventCreateRoute from "@/interface/routes/life-events/route"
import * as lifeEventDetailRoute from "@/interface/routes/life-events/[id]/route"
import * as lifeEventMineRoute from "@/interface/routes/life-events/me/route"
import * as lifeEventAdminRoute from "@/interface/routes/life-events/admin/route"
import * as lifeEventApproveRoute from "@/interface/routes/life-events/[id]/approve/route"
import * as lifeEventRejectRoute from "@/interface/routes/life-events/[id]/reject/route"
import * as familyCareLeaveCreateRoute from "@/interface/routes/family-care-leaves/route"
import * as familyCareLeaveDetailRoute from "@/interface/routes/family-care-leaves/[id]/route"
import * as familyCareLeaveMineRoute from "@/interface/routes/family-care-leaves/me/route"
import * as familyCareLeaveAdminRoute from "@/interface/routes/family-care-leaves/admin/route"
import * as familyCareLeaveApproveRoute from "@/interface/routes/family-care-leaves/[id]/approve/route"
import * as familyCareLeaveCancelRoute from "@/interface/routes/family-care-leaves/[id]/cancel/route"
import * as certificateRequestCreateRoute from "@/interface/routes/certificate-requests/route"
import * as certificateRequestDetailRoute from "@/interface/routes/certificate-requests/[id]/route"
import * as certificateRequestMineRoute from "@/interface/routes/certificate-requests/me/route"
import * as certificateRequestAdminRoute from "@/interface/routes/certificate-requests/admin/route"
import * as certificateRequestIssueRoute from "@/interface/routes/certificate-requests/[id]/issue/route"
import * as certificateRequestRejectRoute from "@/interface/routes/certificate-requests/[id]/reject/route"
import * as antisocialCheckCreateRoute from "@/interface/routes/antisocial-checks/route"
import * as antisocialCheckDetailRoute from "@/interface/routes/antisocial-checks/[id]/route"
import * as antisocialCheckMineRoute from "@/interface/routes/antisocial-checks/me/route"
import * as antisocialCheckAdminRoute from "@/interface/routes/antisocial-checks/admin/route"
import * as applicationTemplateCreateRoute from "@/interface/routes/application-templates/create-route"
import * as roomMasterListRoute from "@/interface/routes/rooms/route"
import * as roomMasterDetailRoute from "@/interface/routes/rooms/[id]/route"
import * as surveyCreateRoute from "@/interface/routes/surveys/create-route"
import * as surveyDetailRoute from "@/interface/routes/surveys/[survey_id]/route"
import * as onboardingTemplateDetailRoute from "@/interface/routes/onboarding/templates/[code]/route"
import * as onboardingLifecycleBindingRoute from "@/interface/routes/onboarding/templates/[code]/lifecycle-binding/route"
import * as iamRolesRoute from "@/interface/routes/roles/route"
import * as iamPermissionsRoute from "@/interface/routes/permissions/route"
import * as iamAccountsRoute from "@/interface/routes/accounts/route"
import * as iamAccountRolesRoute from "@/interface/routes/accounts/[id]/roles/route"
import * as iamRoleDetailRoute from "@/interface/routes/roles/[id]/route"
import * as iamAccountStatusRoute from "@/interface/routes/accounts/[id]/status/route"
import * as iamAccountRoleRevokeRoute from "@/interface/routes/accounts/[id]/roles/[roleKey]/route"
import * as iamAccountResetPasswordRoute from "@/interface/routes/accounts/[id]/reset-password/route"
import * as reviewCycleEditRoute from "@/interface/routes/review-cycles/[cycle_id]/route"
import * as meetingListRoute from "@/interface/routes/meetings/route"
import * as meetingDetailRoute from "@/interface/routes/meetings/[code]/route"
import * as meetingArchiveRoute from "@/interface/routes/meetings/[code]/archive/route"
import * as meetingMinutesListRoute from "@/interface/routes/meetings/[code]/minutes/route"
import * as meetingMinutesDetailRoute from "@/interface/routes/minutes/[id]/route"
import * as decisionListRoute from "@/interface/routes/decisions/route"
import * as decisionDetailRoute from "@/interface/routes/decisions/[id]/route"
import * as decisionSupersedeRoute from "@/interface/routes/decisions/[id]/supersede/route"
import * as recruitmentPositionListRoute from "@/interface/routes/recruitment/positions/route"
import * as recruitmentPositionDetailRoute from "@/interface/routes/recruitment/positions/[id]/route"
import * as recruitmentCandidateListRoute from "@/interface/routes/recruitment/positions/[id]/candidates/route"
import * as recruitmentCandidateDetailRoute from "@/interface/routes/recruitment/candidates/[id]/route"
import * as recruitmentCandidateAdvanceRoute from "@/interface/routes/recruitment/candidates/[id]/advance/route"
import * as commendationListRoute from "@/interface/routes/commendations/route"
import * as commendationDetailRoute from "@/interface/routes/commendations/[id]/route"
import * as disciplinaryActionListRoute from "@/interface/routes/disciplinary-actions/route"
import * as headcountPlanListRoute from "@/interface/routes/headcount-plans/route"
import * as headcountPlanDetailRoute from "@/interface/routes/headcount-plans/[id]/route"
import * as licenseListRoute from "@/interface/routes/licenses/route"
import * as licenseDetailRoute from "@/interface/routes/licenses/[id]/route"
import * as licenseCancelRoute from "@/interface/routes/licenses/[id]/cancel/route"
import * as itIncidentListRoute from "@/interface/routes/it-incidents/route"
import * as itIncidentResolveRoute from "@/interface/routes/it-incidents/[id]/resolve/route"
import * as salaryRevisionListRoute from "@/interface/routes/salary-revisions/route"

/** CORS_ORIGIN 未設定時に許可するローカル開発用 Origin。 */
const defaultAllowedOrigins = ["http://localhost:3000", "http://localhost:5173"]

let corsWarningLogged = false

/**
 * Origin リクエストヘッダを env.CORS_ORIGIN（カンマ区切り）と照合し、許可された Origin のみ返す。
 * 未設定時は defaultAllowedOrigins のみ許可し、セキュリティ警告をログに出す。
 * 本番では必ず CORS_ORIGIN を設定すること。
 */
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

/**
 * interface/ のファイル構造（Next.js App Router 記法）を Hono のメソッドチェーンに対応づける。
 * 動的セグメント [code] は :code として登録する。RPC（hc）のため必ずチェーンで繋ぐ。
 */
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
  .get("/me/departments", ...meDepartmentsRoute.GET)
  .get("/me/reports", ...meReportsRoute.GET)
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
  .get("/dashboard/management", ...dashboardManagementRoute.GET)
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
  .get("/goals/tree", ...goalTreeRoute.GET)
  .post("/goals", ...goalCreateRoute.POST)
  .post("/goals/:goal_id/evaluations", ...goalEvaluationCreateRoute.POST)
  .get("/grades/assignments", ...gradeAssignmentsRoute.GET)
  .post("/grades/assignments", ...gradeAssignmentsRoute.POST)
  .get("/grades", ...gradeListRoute.GET)
  .post("/grades", ...gradeCreateRoute.POST)
  .put("/grades/:id", ...gradeDetailRoute.PUT)
  .delete("/grades/:id", ...gradeDetailRoute.DELETE)
  .get("/positions", ...positionListRoute.GET)
  .post("/positions", ...positionCreateRoute.POST)
  .put("/positions/:id", ...positionDetailRoute.PUT)
  .delete("/positions/:id", ...positionDetailRoute.DELETE)
  .get("/employee-events", ...employeeEventsRoute.GET)
  .post("/employee-events", ...employeeEventsRoute.POST)
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
  .get("/announcements/:id", ...announcementDetailRoute.GET)
  .get("/announcements", ...announcementListRoute.GET)
  .get("/regulations/:code", ...regulationDetailRoute.GET)
  .get("/regulations", ...regulationListRoute.GET)
  .get("/documents", ...documentListRoute.GET)
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
  .post("/partners/:id/archive", ...partnerArchiveRoute.POST)
  .get("/partners/:code", ...partnerDetailRoute.GET)
  .put("/partners/:id", ...partnerUpdateRoute.PUT)
  .post("/partners", ...partnerListRoute.POST)
  .get("/partners", ...partnerListRoute.GET)
  .get("/contracts", ...contractListRoute.GET)
  .post("/contracts", ...contractListRoute.POST)
  .put("/contracts/:id", ...contractDetailRoute.PUT)
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
  .get("/attendance/overtime-summary", ...attendanceOvertimeSummaryRoute.GET)
  .get("/calendar", ...calendarListRoute.GET)
  .post("/calendar/days", ...calendarDayCreateRoute.POST)
  .delete("/calendar/days/:id", ...calendarDayDetailRoute.DELETE)
  .get("/work-styles", ...workStyleRoute.GET)
  .post("/work-styles", ...workStyleRoute.POST)
  .get("/leave/balance/me", ...leaveBalanceMeRoute.GET)
  .get("/leave/balance", ...leaveBalanceRoute.GET)
  .get("/leave/requests/admin", ...leaveRequestAdminRoute.GET)
  .get("/leave/requests/inbox", ...leaveRequestInboxRoute.GET)
  .get("/leave/requests/me", ...leaveRequestMeRoute.GET)
  .get("/leave/requests", ...leaveRequestCreateRoute.GET)
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
  .post("/review-cycles/:cycle_id/disclose", ...reviewCycleDiscloseRoute.POST)
  .post("/review-cycles/:cycle_id/forms/bulk", ...reviewCycleFormsBulkRoute.POST)
  .get("/review-cycles/:cycle_id/results/:employee_code", ...reviewCycleResultsRoute.GET)
  .get("/review-cycles/:cycle_id/policy", ...reviewCyclePolicyRoute.GET)
  .put("/review-cycles/:cycle_id/policy", ...reviewCyclePolicyRoute.PUT)
  .post("/review-forms/:form_id/submit", ...reviewFormSubmitRoute.POST)
  .get("/review-forms/me", ...reviewFormMeRoute.GET)
  .get("/review-forms", ...reviewFormsRoute.GET)
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
  .post("/announcements", ...announcementListRoute.POST)
  .put("/announcements/:id", ...announcementDetailRoute.PUT)
  .post("/announcements/:id/publish", ...announcementPublishRoute.POST)
  .post("/announcements/:id/archive", ...announcementArchiveRoute.POST)
  .post("/regulations", ...regulationListRoute.POST)
  .post("/regulations/:code/versions", ...regulationVersionsRoute.POST)
  .post("/regulations/:code/archive", ...regulationArchiveRoute.POST)
  .post("/documents", ...documentListRoute.POST)
  .put("/documents/:id", ...documentDetailRoute.PUT)
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
  .get("/business-trips/admin", ...businessTripAdminRoute.GET)
  .get("/business-trips/:id", ...businessTripDetailRoute.GET)
  .put("/business-trips/:id", ...businessTripDetailRoute.PUT)
  .delete("/business-trips/:id", ...businessTripDetailRoute.DELETE)
  .post("/business-trips/:id/approve", ...businessTripApproveRoute.POST)
  .post("/business-trips/:id/reject", ...businessTripRejectRoute.POST)
  .get("/certifications", ...certificationListRoute.GET)
  .post("/certifications", ...certificationListRoute.POST)
  .put("/certifications/:id", ...certificationDetailRoute.PUT)
  .get("/employee-certifications", ...employeeCertificationListRoute.GET)
  .post("/employee-certifications", ...employeeCertificationListRoute.POST)
  .delete("/employee-certifications/:id", ...employeeCertificationDetailRoute.DELETE)
  .get("/health-checkups", ...healthCheckupListRoute.GET)
  .post("/health-checkups", ...healthCheckupListRoute.POST)
  .post("/health-checkups/:id/complete", ...healthCheckupCompleteRoute.POST)
  .get("/work-accidents", ...workAccidentListRoute.GET)
  .post("/work-accidents", ...workAccidentListRoute.POST)
  .post("/work-accidents/:id/close", ...workAccidentCloseRoute.POST)
  .post("/rentals", ...rentalReservationCreateRoute.POST)
  .get("/rentals/me", ...rentalReservationMineRoute.GET)
  .get("/rentals/admin", ...rentalReservationAdminRoute.GET)
  .get("/rentals/:id", ...rentalReservationDetailRoute.GET)
  .put("/rentals/:id", ...rentalReservationDetailRoute.PUT)
  .delete("/rentals/:id", ...rentalReservationDetailRoute.DELETE)
  .post("/rentals/:id/lend", ...rentalReservationLendRoute.POST)
  .post("/rentals/:id/return", ...rentalReservationReturnRoute.POST)
  .get("/ringi/admin", ...ringiAdminRoute.GET)
  .get("/ringi/inbox", ...ringiInboxRoute.GET)
  .get("/ringi/me", ...ringiMeRoute.GET)
  .post("/ringi/:id/approve", ...ringiApproveRoute.POST)
  .post("/ringi/:id/reject", ...ringiRejectRoute.POST)
  .post("/ringi", ...ringiCreateRoute.POST)
  .post("/resignations", ...resignationCreateRoute.POST)
  .get("/resignations/me", ...resignationMineRoute.GET)
  .get("/resignations/admin", ...resignationAdminRoute.GET)
  .get("/resignations/:id", ...resignationDetailRoute.GET)
  .put("/resignations/:id", ...resignationDetailRoute.PUT)
  .delete("/resignations/:id", ...resignationDetailRoute.DELETE)
  .post("/resignations/:id/accept", ...resignationAcceptRoute.POST)
  .post("/resignations/:id/reject", ...resignationRejectRoute.POST)
  .post("/life-events", ...lifeEventCreateRoute.POST)
  .get("/life-events/me", ...lifeEventMineRoute.GET)
  .get("/life-events/admin", ...lifeEventAdminRoute.GET)
  .get("/life-events/:id", ...lifeEventDetailRoute.GET)
  .put("/life-events/:id", ...lifeEventDetailRoute.PUT)
  .delete("/life-events/:id", ...lifeEventDetailRoute.DELETE)
  .post("/life-events/:id/approve", ...lifeEventApproveRoute.POST)
  .post("/life-events/:id/reject", ...lifeEventRejectRoute.POST)
  .post("/family-care-leaves", ...familyCareLeaveCreateRoute.POST)
  .get("/family-care-leaves/me", ...familyCareLeaveMineRoute.GET)
  .get("/family-care-leaves/admin", ...familyCareLeaveAdminRoute.GET)
  .get("/family-care-leaves/:id", ...familyCareLeaveDetailRoute.GET)
  .put("/family-care-leaves/:id", ...familyCareLeaveDetailRoute.PUT)
  .delete("/family-care-leaves/:id", ...familyCareLeaveDetailRoute.DELETE)
  .post("/family-care-leaves/:id/approve", ...familyCareLeaveApproveRoute.POST)
  .post("/family-care-leaves/:id/cancel", ...familyCareLeaveCancelRoute.POST)
  .post("/certificate-requests", ...certificateRequestCreateRoute.POST)
  .get("/certificate-requests/me", ...certificateRequestMineRoute.GET)
  .get("/certificate-requests/admin", ...certificateRequestAdminRoute.GET)
  .get("/certificate-requests/:id", ...certificateRequestDetailRoute.GET)
  .put("/certificate-requests/:id", ...certificateRequestDetailRoute.PUT)
  .delete("/certificate-requests/:id", ...certificateRequestDetailRoute.DELETE)
  .post("/certificate-requests/:id/issue", ...certificateRequestIssueRoute.POST)
  .post("/certificate-requests/:id/reject", ...certificateRequestRejectRoute.POST)
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
  .get("/meetings", ...meetingListRoute.GET)
  .post("/meetings", ...meetingListRoute.POST)
  .post("/meetings/:code/archive", ...meetingArchiveRoute.POST)
  .get("/meetings/:code/minutes", ...meetingMinutesListRoute.GET)
  .post("/meetings/:code/minutes", ...meetingMinutesListRoute.POST)
  .get("/meetings/:code", ...meetingDetailRoute.GET)
  .put("/meetings/:code", ...meetingDetailRoute.PUT)
  .get("/minutes/:id", ...meetingMinutesDetailRoute.GET)
  .put("/minutes/:id", ...meetingMinutesDetailRoute.PUT)
  .post("/decisions/:id/supersede", ...decisionSupersedeRoute.POST)
  .get("/decisions", ...decisionListRoute.GET)
  .post("/decisions", ...decisionListRoute.POST)
  .get("/decisions/:id", ...decisionDetailRoute.GET)
  .put("/decisions/:id", ...decisionDetailRoute.PUT)
  .post("/recruitment/candidates/:id/advance", ...recruitmentCandidateAdvanceRoute.POST)
  .put("/recruitment/candidates/:id", ...recruitmentCandidateDetailRoute.PUT)
  .get("/recruitment/positions/:id/candidates", ...recruitmentCandidateListRoute.GET)
  .post("/recruitment/positions/:id/candidates", ...recruitmentCandidateListRoute.POST)
  .get("/recruitment/positions/:id", ...recruitmentPositionDetailRoute.GET)
  .put("/recruitment/positions/:id", ...recruitmentPositionDetailRoute.PUT)
  .get("/recruitment/positions", ...recruitmentPositionListRoute.GET)
  .post("/recruitment/positions", ...recruitmentPositionListRoute.POST)
  .get("/commendations", ...commendationListRoute.GET)
  .post("/commendations", ...commendationListRoute.POST)
  .delete("/commendations/:id", ...commendationDetailRoute.DELETE)
  .get("/disciplinary-actions", ...disciplinaryActionListRoute.GET)
  .post("/disciplinary-actions", ...disciplinaryActionListRoute.POST)
  .get("/headcount-plans", ...headcountPlanListRoute.GET)
  .post("/headcount-plans", ...headcountPlanListRoute.POST)
  .put("/headcount-plans/:id", ...headcountPlanDetailRoute.PUT)
  .get("/licenses", ...licenseListRoute.GET)
  .post("/licenses", ...licenseListRoute.POST)
  .post("/licenses/:id/cancel", ...licenseCancelRoute.POST)
  .put("/licenses/:id", ...licenseDetailRoute.PUT)
  .get("/it-incidents", ...itIncidentListRoute.GET)
  .post("/it-incidents", ...itIncidentListRoute.POST)
  .post("/it-incidents/:id/resolve", ...itIncidentResolveRoute.POST)
  .get("/salary-revisions", ...salaryRevisionListRoute.GET)
  .post("/salary-revisions", ...salaryRevisionListRoute.POST)

export type AppType = typeof app

/**
 * hc の型計算を api 側（型解決できる環境）で済ませた Client 型。
 * web/cli はこの型と AppType を type-only で import し、自前の hc<AppType>() に渡す。
 * 実行時に app 本体（全ルート）を消費側のバンドルへ引き込まないよう、ファクトリは置かない。
 */
export type ApiClient = ReturnType<typeof hc<AppType>>
