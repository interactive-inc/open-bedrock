// このファイルは `bun run gen:app` が生成する。手で編集しない。
// ルートを足すときは登録済みcontextのinterface/routesへ置き、生成器を再実行する。
// middleware・エラーハンドラは手書きの api/app-base.ts が持つ。

import { hc } from "hono/client"
import { appBase, createRouteApp } from "@/api/app-base"
import * as accountsIdResetPasswordRoute from "@/api/routes/accounts/[id]/reset-password/route"
import * as accountsIdRolesRoleKeyRoute from "@/api/routes/accounts/[id]/roles/[roleKey]/route"
import * as accountsIdRolesRoute from "@/api/routes/accounts/[id]/roles/route"
import * as accountsIdStatusRoute from "@/api/routes/accounts/[id]/status/route"
import * as accountsRoute from "@/api/routes/accounts/route"
import * as applicationRequestsIdApproveRoute from "@/api/routes/application-requests/[id]/approve/route"
import * as applicationRequestsIdReassignWorkflowStepRoute from "@/api/routes/application-requests/[id]/reassign-workflow-step/route"
import * as applicationRequestsIdRejectRoute from "@/api/routes/application-requests/[id]/reject/route"
import * as applicationRequestsIdResubmitRoute from "@/api/routes/application-requests/[id]/resubmit/route"
import * as applicationRequestsIdRoute from "@/api/routes/application-requests/[id]/route"
import * as applicationRequestsAdminRoute from "@/api/routes/application-requests/admin/route"
import * as applicationRequestsInboxRoute from "@/api/routes/application-requests/inbox/route"
import * as applicationRequestsMeRoute from "@/api/routes/application-requests/me/route"
import * as applicationRequestsRoute from "@/api/routes/application-requests/route"
import * as applicationRequestsSubmitRoute from "@/api/routes/application-requests/submit-route"
import * as applicationRequestsWorkflowRepairsRoute from "@/api/routes/application-requests/workflow-repairs/route"
import * as applicationTemplatesCodeRoute from "@/api/routes/application-templates/[code]/route"
import * as applicationTemplatesCodeWorkflowRoute from "@/api/routes/application-templates/[code]/workflow/route"
import * as applicationTemplatesCreateRoute from "@/api/routes/application-templates/create-route"
import * as applicationTemplatesRoute from "@/api/routes/application-templates/route"
import * as approvalDelegationsIdRoute from "@/api/routes/approval-delegations/[id]/route"
import * as approvalDelegationsRoute from "@/api/routes/approval-delegations/route"
import * as attendanceRecordsOvertimeSummaryRoute from "@/api/routes/attendance-records/overtime-summary/route"
import * as auditEventExportsRoute from "@/api/routes/audit-event-exports/route"
import * as auditEventsEventIdRoute from "@/api/routes/audit-events/[event_id]/route"
import * as auditEventsRoute from "@/api/routes/audit-events/route"
import * as authBrowserCodeRoute from "@/api/routes/auth/browser/code/route"
import * as authBrowserTokenRoute from "@/api/routes/auth/browser/token/route"
import * as authCliCallbackRoute from "@/api/routes/auth/cli/callback/route"
import * as authCliLoginRoute from "@/api/routes/auth/cli/login/route"
import * as authCliTokenRoute from "@/api/routes/auth/cli/token/route"
import * as authIdentityLoginRoute from "@/api/routes/auth/identity/login/route"
import * as authLoginRoute from "@/api/routes/auth/login/route"
import * as authLogoutRoute from "@/api/routes/auth/logout/route"
import * as authRefreshRoute from "@/api/routes/auth/refresh/route"
import * as batchMigratePasswordHashesRoute from "@/api/routes/batch/migrate-password-hashes/route"
import * as bootstrapRoute from "@/api/routes/bootstrap/route"
import * as dashboardManagementRoute from "@/api/routes/dashboard/management/route"
import * as dashboardRoute from "@/api/routes/dashboard/route"
import * as featuresRoute from "@/api/routes/features/route"
import * as governanceDocumentsImpactRoute from "@/api/routes/governance-documents/impact/route"
import * as governanceDocumentsSyncRoute from "@/api/routes/governance-documents/sync/route"
import * as inboxCountsRoute from "@/api/routes/inbox/counts/route"
import * as meDepartmentsRoute from "@/api/routes/me/departments/route"
import * as mePhoneRoute from "@/api/routes/me/phone/route"
import * as meReportsRoute from "@/api/routes/me/reports/route"
import * as meRoute from "@/api/routes/me/route"
import * as notificationsIdReadRoute from "@/api/routes/notifications/[id]/read/route"
import * as notificationsIdRoute from "@/api/routes/notifications/[id]/route"
import * as notificationsMeRoute from "@/api/routes/notifications/me/route"
import * as notificationsMeUnreadCountRoute from "@/api/routes/notifications/me/unread-count/route"
import * as notificationsReadAllRoute from "@/api/routes/notifications/read-all/route"
import * as notificationsRoute from "@/api/routes/notifications/route"
import * as permissionDefinitionsRoute from "@/api/routes/permission-definitions/route"
import * as provisioningIdentitiesRoute from "@/api/routes/provisioning/identities/route"
import * as rolesIdRoute from "@/api/routes/roles/[id]/route"
import * as rolesRoute from "@/api/routes/roles/route"
import * as announcementsIdArchiveRoute from "@/contexts/announcement/interface/routes/announcements/[id]/archive/route"
import * as announcementsIdPublishRoute from "@/contexts/announcement/interface/routes/announcements/[id]/publish/route"
import * as announcementsIdRoute from "@/contexts/announcement/interface/routes/announcements/[id]/route"
import * as announcementsRoute from "@/contexts/announcement/interface/routes/announcements/route"
import * as antisocialChecksIdRoute from "@/contexts/antisocial-check/interface/routes/antisocial-checks/[id]/route"
import * as antisocialChecksAdminRoute from "@/contexts/antisocial-check/interface/routes/antisocial-checks/admin/route"
import * as antisocialChecksMeRoute from "@/contexts/antisocial-check/interface/routes/antisocial-checks/me/route"
import * as antisocialChecksRoute from "@/contexts/antisocial-check/interface/routes/antisocial-checks/route"
import * as assetsCodeDisposeRoute from "@/contexts/asset/interface/routes/assets/[code]/dispose/route"
import * as assetsCodeLendRoute from "@/contexts/asset/interface/routes/assets/[code]/lend/route"
import * as assetsCodeReturnRoute from "@/contexts/asset/interface/routes/assets/[code]/return/route"
import * as assetsCodeRoute from "@/contexts/asset/interface/routes/assets/[code]/route"
import * as assetsHoldingsRoute from "@/contexts/asset/interface/routes/assets/holdings/route"
import * as assetsLentMeRoute from "@/contexts/asset/interface/routes/assets/lent/me/route"
import * as assetsRegisterRoute from "@/contexts/asset/interface/routes/assets/register-route"
import * as assetsRoute from "@/contexts/asset/interface/routes/assets/route"
import * as stocktakesIdAssetsCodeCheckRoute from "@/contexts/asset/interface/routes/stocktakes/[id]/assets/[code]/check/route"
import * as stocktakesIdCloseRoute from "@/contexts/asset/interface/routes/stocktakes/[id]/close/route"
import * as stocktakesIdRoute from "@/contexts/asset/interface/routes/stocktakes/[id]/route"
import * as stocktakesRoute from "@/contexts/asset/interface/routes/stocktakes/route"
import * as attendanceRecordsClockInRoute from "@/contexts/attendance/interface/routes/attendance-records/clock-in/route"
import * as attendanceRecordsClockOutRoute from "@/contexts/attendance/interface/routes/attendance-records/clock-out/route"
import * as attendanceRecordsMeRoute from "@/contexts/attendance/interface/routes/attendance-records/me/route"
import * as attendanceRecordsMeSummaryRoute from "@/contexts/attendance/interface/routes/attendance-records/me/summary/route"
import * as attendanceRecordsRoute from "@/contexts/attendance/interface/routes/attendance-records/route"
import * as businessTripsIdApproveRoute from "@/contexts/business-trip/interface/routes/business-trips/[id]/approve/route"
import * as businessTripsIdRejectRoute from "@/contexts/business-trip/interface/routes/business-trips/[id]/reject/route"
import * as businessTripsIdRoute from "@/contexts/business-trip/interface/routes/business-trips/[id]/route"
import * as businessTripsAdminRoute from "@/contexts/business-trip/interface/routes/business-trips/admin/route"
import * as businessTripsMeRoute from "@/contexts/business-trip/interface/routes/business-trips/me/route"
import * as businessTripsRoute from "@/contexts/business-trip/interface/routes/business-trips/route"
import * as careerApplicationsIdRoute from "@/contexts/career/interface/routes/career-applications/[id]/route"
import * as careerApplicationsMeRoute from "@/contexts/career/interface/routes/career-applications/me/route"
import * as careerPostingsPostingIdApplyRoute from "@/contexts/career/interface/routes/career-postings/[posting_id]/apply/route"
import * as careerPostingsPostingIdRoute from "@/contexts/career/interface/routes/career-postings/[posting_id]/route"
import * as careerPostingsRoute from "@/contexts/career/interface/routes/career-postings/route"
import * as careerSheetsMeRoute from "@/contexts/career/interface/routes/career-sheets/me/route"
import * as careerSheetsMeUpdateRoute from "@/contexts/career/interface/routes/career-sheets/me/update-route"
import * as certificateRequestsIdIssueRoute from "@/contexts/certificate-request/interface/routes/certificate-requests/[id]/issue/route"
import * as certificateRequestsIdRejectRoute from "@/contexts/certificate-request/interface/routes/certificate-requests/[id]/reject/route"
import * as certificateRequestsIdRoute from "@/contexts/certificate-request/interface/routes/certificate-requests/[id]/route"
import * as certificateRequestsAdminRoute from "@/contexts/certificate-request/interface/routes/certificate-requests/admin/route"
import * as certificateRequestsMeRoute from "@/contexts/certificate-request/interface/routes/certificate-requests/me/route"
import * as certificateRequestsRoute from "@/contexts/certificate-request/interface/routes/certificate-requests/route"
import * as certificationDefinitionsIdRoute from "@/contexts/certification/interface/routes/certification-definitions/[id]/route"
import * as certificationDefinitionsRoute from "@/contexts/certification/interface/routes/certification-definitions/route"
import * as employeeCertificationsIdRoute from "@/contexts/certification/interface/routes/employee-certifications/[id]/route"
import * as employeeCertificationsRoute from "@/contexts/certification/interface/routes/employee-certifications/route"
import * as commendationsIdRoute from "@/contexts/commendation/interface/routes/commendations/[id]/route"
import * as commendationsRoute from "@/contexts/commendation/interface/routes/commendations/route"
import * as companyCalendarDaysIdRoute from "@/contexts/company-calendar/interface/routes/company-calendar-days/[id]/route"
import * as companyCalendarDaysCreateRoute from "@/contexts/company-calendar/interface/routes/company-calendar-days/create-route"
import * as companyCalendarDaysRoute from "@/contexts/company-calendar/interface/routes/company-calendar-days/route"
import * as batchEmployeeLifecycleBackfillRoute from "@/contexts/company/interface/routes/batch/employee-lifecycle/backfill/route"
import * as batchEmployeeLifecyclePreflightRoute from "@/contexts/company/interface/routes/batch/employee-lifecycle/preflight/route"
import * as batchEmployeeLifecycleProcessOutboxRoute from "@/contexts/company/interface/routes/batch/employee-lifecycle/process-outbox/route"
import * as batchEmployeeLifecycleRebuildProjectionsRoute from "@/contexts/company/interface/routes/batch/employee-lifecycle/rebuild-projections/route"
import * as batchEmployeeLifecycleVerifyRoute from "@/contexts/company/interface/routes/batch/employee-lifecycle/verify/route"
import * as batchRoute from "@/contexts/company/interface/routes/batch/route"
import * as departmentDefinitionsCreateRoute from "@/contexts/company/interface/routes/department-definitions/create-route"
import * as departmentDefinitionsRoute from "@/contexts/company/interface/routes/department-definitions/route"
import * as departmentsCodeMembersRoute from "@/contexts/company/interface/routes/departments/[code]/members/route"
import * as departmentsCodeRoute from "@/contexts/company/interface/routes/departments/[code]/route"
import * as departmentsRoute from "@/contexts/company/interface/routes/departments/route"
import * as departmentsTreeRoute from "@/contexts/company/interface/routes/departments/tree/route"
import * as directoryEmployeesRoute from "@/contexts/company/interface/routes/directory/employees/route"
import * as employeeEventsRoute from "@/contexts/company/interface/routes/employee-events/route"
import * as employeeGradesRoute from "@/contexts/company/interface/routes/employee-grades/route"
import * as employeesCodeArchiveRoute from "@/contexts/company/interface/routes/employees/[code]/archive/route"
import * as employeesCodeLifecycleEventsRoute from "@/contexts/company/interface/routes/employees/[code]/lifecycle-events/route"
import * as employeesCodeLifecycleStateRoute from "@/contexts/company/interface/routes/employees/[code]/lifecycle-state/route"
import * as employeesCodeReportingLineRoute from "@/contexts/company/interface/routes/employees/[code]/reporting-line/route"
import * as employeesCodeRoute from "@/contexts/company/interface/routes/employees/[code]/route"
import * as employeesRoute from "@/contexts/company/interface/routes/employees/route"
import * as gradeDefinitionsIdRoute from "@/contexts/company/interface/routes/grade-definitions/[id]/route"
import * as gradeDefinitionsCreateRoute from "@/contexts/company/interface/routes/grade-definitions/create-route"
import * as gradeDefinitionsRoute from "@/contexts/company/interface/routes/grade-definitions/route"
import * as personnelActionRequestsIdRoute from "@/contexts/company/interface/routes/personnel-action-requests/[id]/route"
import * as personnelActionRequestsRoute from "@/contexts/company/interface/routes/personnel-action-requests/route"
import * as personnelActionsIdCorrectRoute from "@/contexts/company/interface/routes/personnel-actions/[id]/correct/route"
import * as personnelActionsRoute from "@/contexts/company/interface/routes/personnel-actions/route"
import * as positionDefinitionsIdRoute from "@/contexts/company/interface/routes/position-definitions/[id]/route"
import * as positionDefinitionsCreateRoute from "@/contexts/company/interface/routes/position-definitions/create-route"
import * as positionDefinitionsRoute from "@/contexts/company/interface/routes/position-definitions/route"
import * as salaryRevisionsRoute from "@/contexts/compensation-change/interface/routes/salary-revisions/route"
import * as disciplinaryActionsRoute from "@/contexts/disciplinary-action/interface/routes/disciplinary-actions/route"
import * as documentLedgerEntriesIdRoute from "@/contexts/document/interface/routes/document-ledger-entries/[id]/route"
import * as documentLedgerEntriesRoute from "@/contexts/document/interface/routes/document-ledger-entries/route"
import * as departmentBudgetsIdRoute from "@/contexts/expense/interface/routes/department-budgets/[id]/route"
import * as departmentBudgetsRoute from "@/contexts/expense/interface/routes/department-budgets/route"
import * as departmentBudgetsSummaryRoute from "@/contexts/expense/interface/routes/department-budgets/summary/route"
import * as expensesIdApproveRoute from "@/contexts/expense/interface/routes/expenses/[id]/approve/route"
import * as expensesIdRejectRoute from "@/contexts/expense/interface/routes/expenses/[id]/reject/route"
import * as expensesIdRoute from "@/contexts/expense/interface/routes/expenses/[id]/route"
import * as expensesAdminRoute from "@/contexts/expense/interface/routes/expenses/admin/route"
import * as expensesInboxRoute from "@/contexts/expense/interface/routes/expenses/inbox/route"
import * as expensesMeRoute from "@/contexts/expense/interface/routes/expenses/me/route"
import * as expensesRoute from "@/contexts/expense/interface/routes/expenses/route"
import * as familyCareLeavesIdApproveRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves/[id]/approve/route"
import * as familyCareLeavesIdCancelRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves/[id]/cancel/route"
import * as familyCareLeavesIdRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves/[id]/route"
import * as familyCareLeavesAdminRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves/admin/route"
import * as familyCareLeavesMeRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves/me/route"
import * as familyCareLeavesRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves/route"
import * as governanceCapabilitiesRoute from "@/contexts/governance/interface/routes/governance-capabilities/route"
import * as governanceDocumentsCodeAcknowledgeRoute from "@/contexts/governance/interface/routes/governance-documents/[code]/acknowledge/route"
import * as governanceDocumentsCodeRoute from "@/contexts/governance/interface/routes/governance-documents/[code]/route"
import * as governanceDocumentsCodeVersionsVersionPublishRoute from "@/contexts/governance/interface/routes/governance-documents/[code]/versions/[version]/publish/route"
import * as governanceDocumentsCodeVersionsVersionReviewRoute from "@/contexts/governance/interface/routes/governance-documents/[code]/versions/[version]/review/route"
import * as governanceDocumentsCodeVersionsVersionSubmitReviewRoute from "@/contexts/governance/interface/routes/governance-documents/[code]/versions/[version]/submit-review/route"
import * as governanceDocumentsRoute from "@/contexts/governance/interface/routes/governance-documents/route"
import * as governanceOrgRolesCodeAssignmentsRoute from "@/contexts/governance/interface/routes/governance-org-roles/[code]/assignments/route"
import * as governanceOrgRolesAssignmentsIdRoute from "@/contexts/governance/interface/routes/governance-org-roles/assignments/[id]/route"
import * as governanceOrgRolesRoute from "@/contexts/governance/interface/routes/governance-org-roles/route"
import * as headcountPlansIdRoute from "@/contexts/headcount-plan/interface/routes/headcount-plans/[id]/route"
import * as headcountPlansRoute from "@/contexts/headcount-plan/interface/routes/headcount-plans/route"
import * as healthCheckupsIdCompleteRoute from "@/contexts/health-checkup/interface/routes/health-checkups/[id]/complete/route"
import * as healthCheckupsRoute from "@/contexts/health-checkup/interface/routes/health-checkups/route"
import * as itIncidentsIdResolveRoute from "@/contexts/it-incident/interface/routes/it-incidents/[id]/resolve/route"
import * as itIncidentsRoute from "@/contexts/it-incident/interface/routes/it-incidents/route"
import * as knowledgeArticlesIdRoute from "@/contexts/knowledge/interface/routes/knowledge-articles/[id]/route"
import * as knowledgeArticlesRoute from "@/contexts/knowledge/interface/routes/knowledge-articles/route"
import * as leaveBalancesMeRoute from "@/contexts/leave/interface/routes/leave-balances/me/route"
import * as leaveBalancesRoute from "@/contexts/leave/interface/routes/leave-balances/route"
import * as leaveRequestsIdApproveRoute from "@/contexts/leave/interface/routes/leave-requests/[id]/approve/route"
import * as leaveRequestsIdRejectRoute from "@/contexts/leave/interface/routes/leave-requests/[id]/reject/route"
import * as leaveRequestsIdRoute from "@/contexts/leave/interface/routes/leave-requests/[id]/route"
import * as leaveRequestsAdminRoute from "@/contexts/leave/interface/routes/leave-requests/admin/route"
import * as leaveRequestsInboxRoute from "@/contexts/leave/interface/routes/leave-requests/inbox/route"
import * as leaveRequestsMeRoute from "@/contexts/leave/interface/routes/leave-requests/me/route"
import * as leaveRequestsRoute from "@/contexts/leave/interface/routes/leave-requests/route"
import * as lifeEventsIdApproveRoute from "@/contexts/life-event/interface/routes/life-events/[id]/approve/route"
import * as lifeEventsIdRejectRoute from "@/contexts/life-event/interface/routes/life-events/[id]/reject/route"
import * as lifeEventsIdRoute from "@/contexts/life-event/interface/routes/life-events/[id]/route"
import * as lifeEventsAdminRoute from "@/contexts/life-event/interface/routes/life-events/admin/route"
import * as lifeEventsMeRoute from "@/contexts/life-event/interface/routes/life-events/me/route"
import * as lifeEventsRoute from "@/contexts/life-event/interface/routes/life-events/route"
import * as decisionRecordsIdRoute from "@/contexts/meeting/interface/routes/decision-records/[id]/route"
import * as decisionRecordsIdSupersedeRoute from "@/contexts/meeting/interface/routes/decision-records/[id]/supersede/route"
import * as decisionRecordsRoute from "@/contexts/meeting/interface/routes/decision-records/route"
import * as meetingMinutesRecordsIdRoute from "@/contexts/meeting/interface/routes/meeting-minutes-records/[id]/route"
import * as meetingsCodeArchiveRoute from "@/contexts/meeting/interface/routes/meetings/[code]/archive/route"
import * as meetingsCodeMinutesRoute from "@/contexts/meeting/interface/routes/meetings/[code]/minutes/route"
import * as meetingsCodeRoute from "@/contexts/meeting/interface/routes/meetings/[code]/route"
import * as meetingsRoute from "@/contexts/meeting/interface/routes/meetings/route"
import * as onboardingAssignmentsIdRoute from "@/contexts/onboarding/interface/routes/onboarding-assignments/[id]/route"
import * as onboardingAssignmentsEmployeesEmployeeCodeRoute from "@/contexts/onboarding/interface/routes/onboarding-assignments/employees/[employee_code]/route"
import * as onboardingAssignmentsMeRoute from "@/contexts/onboarding/interface/routes/onboarding-assignments/me/route"
import * as onboardingAssignmentsRoute from "@/contexts/onboarding/interface/routes/onboarding-assignments/route"
import * as onboardingTasksIdCompleteRoute from "@/contexts/onboarding/interface/routes/onboarding-tasks/[id]/complete/route"
import * as onboardingTasksIdUncompleteRoute from "@/contexts/onboarding/interface/routes/onboarding-tasks/[id]/uncomplete/route"
import * as onboardingTemplatesCodeLifecycleBindingRoute from "@/contexts/onboarding/interface/routes/onboarding-templates/[code]/lifecycle-binding/route"
import * as onboardingTemplatesCodeRoute from "@/contexts/onboarding/interface/routes/onboarding-templates/[code]/route"
import * as onboardingTemplatesRoute from "@/contexts/onboarding/interface/routes/onboarding-templates/route"
import * as oneOnOnesIdRoute from "@/contexts/one-on-one/interface/routes/one-on-ones/[id]/route"
import * as oneOnOnesMeRoute from "@/contexts/one-on-one/interface/routes/one-on-ones/me/route"
import * as oneOnOnesRoute from "@/contexts/one-on-one/interface/routes/one-on-ones/route"
import * as partnerContractsIdRoute from "@/contexts/partner/interface/routes/partner-contracts/[id]/route"
import * as partnerContractsRoute from "@/contexts/partner/interface/routes/partner-contracts/route"
import * as partnersCodeRoute from "@/contexts/partner/interface/routes/partners/[code]/route"
import * as partnersIdArchiveRoute from "@/contexts/partner/interface/routes/partners/[id]/archive/route"
import * as partnersIdRoute from "@/contexts/partner/interface/routes/partners/[id]/route"
import * as partnersRoute from "@/contexts/partner/interface/routes/partners/route"
import * as evaluationSheetsSheetIdEvaluatorsRoute from "@/contexts/performance-review/interface/routes/evaluation-sheets/[sheet_id]/evaluators/route"
import * as evaluationSheetsSheetIdRoute from "@/contexts/performance-review/interface/routes/evaluation-sheets/[sheet_id]/route"
import * as evaluationSheetsSheetIdTransitionRoute from "@/contexts/performance-review/interface/routes/evaluation-sheets/[sheet_id]/transition/route"
import * as evaluationSheetsCreateRoute from "@/contexts/performance-review/interface/routes/evaluation-sheets/create-route"
import * as evaluationSheetsMeRoute from "@/contexts/performance-review/interface/routes/evaluation-sheets/me/route"
import * as evaluationSheetsRoute from "@/contexts/performance-review/interface/routes/evaluation-sheets/route"
import * as evaluationTemplatesTemplateIdRoute from "@/contexts/performance-review/interface/routes/evaluation-templates/[template_id]/route"
import * as evaluationTemplatesCreateRoute from "@/contexts/performance-review/interface/routes/evaluation-templates/create-route"
import * as evaluationTemplatesRoute from "@/contexts/performance-review/interface/routes/evaluation-templates/route"
import * as performanceGoalsGoalIdEvaluationsRoute from "@/contexts/performance-review/interface/routes/performance-goals/[goal_id]/evaluations/route"
import * as performanceGoalsGoalIdRoute from "@/contexts/performance-review/interface/routes/performance-goals/[goal_id]/route"
import * as performanceGoalsCreateRoute from "@/contexts/performance-review/interface/routes/performance-goals/create-route"
import * as performanceGoalsMeRoute from "@/contexts/performance-review/interface/routes/performance-goals/me/route"
import * as performanceGoalsRoute from "@/contexts/performance-review/interface/routes/performance-goals/route"
import * as performanceGoalsTreeRoute from "@/contexts/performance-review/interface/routes/performance-goals/tree/route"
import * as reviewCyclesCycleIdCloseRoute from "@/contexts/performance-review/interface/routes/review-cycles/[cycle_id]/close/route"
import * as reviewCyclesCycleIdDiscloseRoute from "@/contexts/performance-review/interface/routes/review-cycles/[cycle_id]/disclose/route"
import * as reviewCyclesCycleIdFormsBulkRoute from "@/contexts/performance-review/interface/routes/review-cycles/[cycle_id]/forms/bulk/route"
import * as reviewCyclesCycleIdOpenRoute from "@/contexts/performance-review/interface/routes/review-cycles/[cycle_id]/open/route"
import * as reviewCyclesCycleIdPolicyRoute from "@/contexts/performance-review/interface/routes/review-cycles/[cycle_id]/policy/route"
import * as reviewCyclesCycleIdResultsEmployeeCodeRoute from "@/contexts/performance-review/interface/routes/review-cycles/[cycle_id]/results/[employee_code]/route"
import * as reviewCyclesCycleIdRoute from "@/contexts/performance-review/interface/routes/review-cycles/[cycle_id]/route"
import * as reviewCyclesCreateRoute from "@/contexts/performance-review/interface/routes/review-cycles/create-route"
import * as reviewCyclesRoute from "@/contexts/performance-review/interface/routes/review-cycles/route"
import * as reviewFormsFormIdSubmitRoute from "@/contexts/performance-review/interface/routes/review-forms/[form_id]/submit/route"
import * as reviewFormsMeRoute from "@/contexts/performance-review/interface/routes/review-forms/me/route"
import * as reviewFormsRoute from "@/contexts/performance-review/interface/routes/review-forms/route"
import * as jobOpeningsJobOpeningIdCandidatesRoute from "@/contexts/recruitment/interface/routes/job-openings/[job_opening_id]/candidates/route"
import * as jobOpeningsJobOpeningIdRoute from "@/contexts/recruitment/interface/routes/job-openings/[job_opening_id]/route"
import * as jobOpeningsRoute from "@/contexts/recruitment/interface/routes/job-openings/route"
import * as recruitmentCandidatesIdAdvanceRoute from "@/contexts/recruitment/interface/routes/recruitment-candidates/[id]/advance/route"
import * as recruitmentCandidatesIdRoute from "@/contexts/recruitment/interface/routes/recruitment-candidates/[id]/route"
import * as regulationsCodeArchiveRoute from "@/contexts/regulation/interface/routes/regulations/[code]/archive/route"
import * as regulationsCodeRoute from "@/contexts/regulation/interface/routes/regulations/[code]/route"
import * as regulationsCodeVersionsRoute from "@/contexts/regulation/interface/routes/regulations/[code]/versions/route"
import * as regulationsRoute from "@/contexts/regulation/interface/routes/regulations/route"
import * as rentalReservationsIdLendRoute from "@/contexts/rental/interface/routes/rental-reservations/[id]/lend/route"
import * as rentalReservationsIdReturnRoute from "@/contexts/rental/interface/routes/rental-reservations/[id]/return/route"
import * as rentalReservationsIdRoute from "@/contexts/rental/interface/routes/rental-reservations/[id]/route"
import * as rentalReservationsAdminRoute from "@/contexts/rental/interface/routes/rental-reservations/admin/route"
import * as rentalReservationsMeRoute from "@/contexts/rental/interface/routes/rental-reservations/me/route"
import * as rentalReservationsRoute from "@/contexts/rental/interface/routes/rental-reservations/route"
import * as resignationsIdAcceptRoute from "@/contexts/resignation/interface/routes/resignations/[id]/accept/route"
import * as resignationsIdRejectRoute from "@/contexts/resignation/interface/routes/resignations/[id]/reject/route"
import * as resignationsIdRoute from "@/contexts/resignation/interface/routes/resignations/[id]/route"
import * as resignationsAdminRoute from "@/contexts/resignation/interface/routes/resignations/admin/route"
import * as resignationsMeRoute from "@/contexts/resignation/interface/routes/resignations/me/route"
import * as resignationsRoute from "@/contexts/resignation/interface/routes/resignations/route"
import * as ringiRequestsIdApproveRoute from "@/contexts/ringi/interface/routes/ringi-requests/[id]/approve/route"
import * as ringiRequestsIdRejectRoute from "@/contexts/ringi/interface/routes/ringi-requests/[id]/reject/route"
import * as ringiRequestsAdminRoute from "@/contexts/ringi/interface/routes/ringi-requests/admin/route"
import * as ringiRequestsInboxRoute from "@/contexts/ringi/interface/routes/ringi-requests/inbox/route"
import * as ringiRequestsMeRoute from "@/contexts/ringi/interface/routes/ringi-requests/me/route"
import * as ringiRequestsRoute from "@/contexts/ringi/interface/routes/ringi-requests/route"
import * as roomsIdRoute from "@/contexts/room/interface/routes/rooms/[id]/route"
import * as roomsAvailabilityRoute from "@/contexts/room/interface/routes/rooms/availability/route"
import * as roomsReservationsIdRoute from "@/contexts/room/interface/routes/rooms/reservations/[id]/route"
import * as roomsReservationsMeRoute from "@/contexts/room/interface/routes/rooms/reservations/me/route"
import * as roomsReservationsRoute from "@/contexts/room/interface/routes/rooms/reservations/route"
import * as roomsRoute from "@/contexts/room/interface/routes/rooms/route"
import * as shiftAssignmentsIdPublishRoute from "@/contexts/shift/interface/routes/shift-assignments/[id]/publish/route"
import * as shiftAssignmentsIdRoute from "@/contexts/shift/interface/routes/shift-assignments/[id]/route"
import * as shiftAssignmentsCreateRoute from "@/contexts/shift/interface/routes/shift-assignments/create-route"
import * as shiftAssignmentsMeRoute from "@/contexts/shift/interface/routes/shift-assignments/me/route"
import * as shiftAssignmentsRoute from "@/contexts/shift/interface/routes/shift-assignments/route"
import * as shiftPatternsIdRoute from "@/contexts/shift/interface/routes/shift-patterns/[id]/route"
import * as shiftPatternsCreateRoute from "@/contexts/shift/interface/routes/shift-patterns/create-route"
import * as shiftPatternsRoute from "@/contexts/shift/interface/routes/shift-patterns/route"
import * as shiftSwapRequestsIdApproveRoute from "@/contexts/shift/interface/routes/shift-swap-requests/[id]/approve/route"
import * as shiftSwapRequestsIdRoute from "@/contexts/shift/interface/routes/shift-swap-requests/[id]/route"
import * as shiftSwapRequestsAdminRoute from "@/contexts/shift/interface/routes/shift-swap-requests/admin/route"
import * as shiftSwapRequestsMeRoute from "@/contexts/shift/interface/routes/shift-swap-requests/me/route"
import * as shiftSwapRequestsRoute from "@/contexts/shift/interface/routes/shift-swap-requests/route"
import * as employeeSkillsMeSkillCodeRoute from "@/contexts/skill/interface/routes/employee-skills/me/[skill_code]/route"
import * as employeeSkillsMeRoute from "@/contexts/skill/interface/routes/employee-skills/me/route"
import * as employeeSkillsMeUpdateRoute from "@/contexts/skill/interface/routes/employee-skills/me/update-route"
import * as skillDefinitionsRoute from "@/contexts/skill/interface/routes/skill-definitions/route"
import * as softwareLicensesIdCancelRoute from "@/contexts/software-license/interface/routes/software-licenses/[id]/cancel/route"
import * as softwareLicensesIdRoute from "@/contexts/software-license/interface/routes/software-licenses/[id]/route"
import * as softwareLicensesRoute from "@/contexts/software-license/interface/routes/software-licenses/route"
import * as surveysSurveyIdResponsesRoute from "@/contexts/survey/interface/routes/surveys/[survey_id]/responses/route"
import * as surveysSurveyIdRoute from "@/contexts/survey/interface/routes/surveys/[survey_id]/route"
import * as surveysSurveyIdSummaryRoute from "@/contexts/survey/interface/routes/surveys/[survey_id]/summary/route"
import * as surveysCreateRoute from "@/contexts/survey/interface/routes/surveys/create-route"
import * as surveysResponsesResponseIdRoute from "@/contexts/survey/interface/routes/surveys/responses/[response_id]/route"
import * as surveysResponsesMeRoute from "@/contexts/survey/interface/routes/surveys/responses/me/route"
import * as surveysRoute from "@/contexts/survey/interface/routes/surveys/route"
import * as thanksMessagesMeRoute from "@/contexts/thanks/interface/routes/thanks-messages/me/route"
import * as thanksMessagesRoute from "@/contexts/thanks/interface/routes/thanks-messages/route"
import * as thanksPointBalancesMeRoute from "@/contexts/thanks/interface/routes/thanks-point-balances/me/route"
import * as thanksPointBudgetsMeRoute from "@/contexts/thanks/interface/routes/thanks-point-budgets/me/route"
import * as thanksRedemptionsIdApproveRoute from "@/contexts/thanks/interface/routes/thanks-redemptions/[id]/approve/route"
import * as thanksRedemptionsIdRejectRoute from "@/contexts/thanks/interface/routes/thanks-redemptions/[id]/reject/route"
import * as thanksRedemptionsAdminRoute from "@/contexts/thanks/interface/routes/thanks-redemptions/admin/route"
import * as thanksRedemptionsInboxRoute from "@/contexts/thanks/interface/routes/thanks-redemptions/inbox/route"
import * as thanksRedemptionsMeRoute from "@/contexts/thanks/interface/routes/thanks-redemptions/me/route"
import * as thanksRedemptionsRoute from "@/contexts/thanks/interface/routes/thanks-redemptions/route"
import * as thanksRewardsIdRoute from "@/contexts/thanks/interface/routes/thanks-rewards/[id]/route"
import * as thanksRewardsRoute from "@/contexts/thanks/interface/routes/thanks-rewards/route"
import * as trainingCoursesCodeRoute from "@/contexts/training/interface/routes/training-courses/[code]/route"
import * as trainingCoursesCreateRoute from "@/contexts/training/interface/routes/training-courses/create-route"
import * as trainingCoursesRoute from "@/contexts/training/interface/routes/training-courses/route"
import * as trainingEnrollmentsIdCompleteRoute from "@/contexts/training/interface/routes/training-enrollments/[id]/complete/route"
import * as trainingEnrollmentsIdRoute from "@/contexts/training/interface/routes/training-enrollments/[id]/route"
import * as trainingEnrollmentsEnrollRoute from "@/contexts/training/interface/routes/training-enrollments/enroll-route"
import * as trainingEnrollmentsMeRoute from "@/contexts/training/interface/routes/training-enrollments/me/route"
import * as trainingEnrollmentsRoute from "@/contexts/training/interface/routes/training-enrollments/route"
import * as workAccidentsIdCloseRoute from "@/contexts/work-accident/interface/routes/work-accidents/[id]/close/route"
import * as workAccidentsRoute from "@/contexts/work-accident/interface/routes/work-accidents/route"
import * as employeeWorkStylesRoute from "@/contexts/work-style/interface/routes/employee-work-styles/route"
import * as healthRoute from "@system/interface/routes/health/route"
import * as systemV1HealthRoute from "@system/interface/routes/system/v1/health/route"

const routePart0 = createRouteApp()
  .get("/accounts", ...accountsRoute.GET)
  .post("/accounts/:id/reset-password", ...accountsIdResetPasswordRoute.POST)
  .post("/accounts/:id/roles", ...accountsIdRolesRoute.POST)
  .delete("/accounts/:id/roles/:roleKey", ...accountsIdRolesRoleKeyRoute.DELETE)
  .post("/accounts/:id/status", ...accountsIdStatusRoute.POST)
  .get("/announcements", ...announcementsRoute.GET)
  .post("/announcements", ...announcementsRoute.POST)
  .get("/announcements/:id", ...announcementsIdRoute.GET)
  .put("/announcements/:id", ...announcementsIdRoute.PUT)
  .post("/announcements/:id/archive", ...announcementsIdArchiveRoute.POST)
  .post("/announcements/:id/publish", ...announcementsIdPublishRoute.POST)
  .post("/antisocial-checks", ...antisocialChecksRoute.POST)
  .get("/antisocial-checks/admin", ...antisocialChecksAdminRoute.GET)
  .get("/antisocial-checks/me", ...antisocialChecksMeRoute.GET)
  .get("/antisocial-checks/:id", ...antisocialChecksIdRoute.GET)
  .put("/antisocial-checks/:id", ...antisocialChecksIdRoute.PUT)
  .delete("/antisocial-checks/:id", ...antisocialChecksIdRoute.DELETE)

const routePart1 = createRouteApp().get("/application-requests", ...applicationRequestsRoute.GET)

const routePart2 = createRouteApp().post(
  "/application-requests",
  ...applicationRequestsSubmitRoute.POST,
)

const routePart3 = createRouteApp().get(
  "/application-requests/admin",
  ...applicationRequestsAdminRoute.GET,
)

const routePart4 = createRouteApp().get(
  "/application-requests/inbox",
  ...applicationRequestsInboxRoute.GET,
)

const routePart5 = createRouteApp().get(
  "/application-requests/me",
  ...applicationRequestsMeRoute.GET,
)

const routePart6 = createRouteApp().get(
  "/application-requests/workflow-repairs",
  ...applicationRequestsWorkflowRepairsRoute.GET,
)

const routePart7 = createRouteApp().get(
  "/application-requests/:id",
  ...applicationRequestsIdRoute.GET,
)

const routePart8 = createRouteApp().put(
  "/application-requests/:id",
  ...applicationRequestsIdRoute.PUT,
)

const routePart9 = createRouteApp().delete(
  "/application-requests/:id",
  ...applicationRequestsIdRoute.DELETE,
)

const routePart10 = createRouteApp().post(
  "/application-requests/:id/approve",
  ...applicationRequestsIdApproveRoute.POST,
)

const routePart11 = createRouteApp().post(
  "/application-requests/:id/reassign-workflow-step",
  ...applicationRequestsIdReassignWorkflowStepRoute.POST,
)

const routePart12 = createRouteApp().post(
  "/application-requests/:id/reject",
  ...applicationRequestsIdRejectRoute.POST,
)

const routePart13 = createRouteApp().post(
  "/application-requests/:id/resubmit",
  ...applicationRequestsIdResubmitRoute.POST,
)

const routePart14 = createRouteApp().get("/application-templates", ...applicationTemplatesRoute.GET)

const routePart15 = createRouteApp().post(
  "/application-templates",
  ...applicationTemplatesCreateRoute.POST,
)

const routePart16 = createRouteApp().get(
  "/application-templates/:code",
  ...applicationTemplatesCodeRoute.GET,
)

const routePart17 = createRouteApp().put(
  "/application-templates/:code",
  ...applicationTemplatesCodeRoute.PUT,
)

const routePart18 = createRouteApp().delete(
  "/application-templates/:code",
  ...applicationTemplatesCodeRoute.DELETE,
)

const routePart19 = createRouteApp().get(
  "/application-templates/:code/workflow",
  ...applicationTemplatesCodeWorkflowRoute.GET,
)

const routePart20 = createRouteApp().put(
  "/application-templates/:code/workflow",
  ...applicationTemplatesCodeWorkflowRoute.PUT,
)

const routePart21 = createRouteApp().get("/approval-delegations", ...approvalDelegationsRoute.GET)

const routePart22 = createRouteApp().post("/approval-delegations", ...approvalDelegationsRoute.POST)

const routePart23 = createRouteApp().delete(
  "/approval-delegations/:id",
  ...approvalDelegationsIdRoute.DELETE,
)

const routePart24 = createRouteApp()
  .get("/assets", ...assetsRoute.GET)
  .post("/assets", ...assetsRegisterRoute.POST)
  .get("/assets/holdings", ...assetsHoldingsRoute.GET)
  .get("/assets/lent/me", ...assetsLentMeRoute.GET)
  .get("/assets/:code", ...assetsCodeRoute.GET)
  .put("/assets/:code", ...assetsCodeRoute.PUT)
  .delete("/assets/:code", ...assetsCodeRoute.DELETE)
  .post("/assets/:code/dispose", ...assetsCodeDisposeRoute.POST)
  .post("/assets/:code/lend", ...assetsCodeLendRoute.POST)
  .post("/assets/:code/return", ...assetsCodeReturnRoute.POST)
  .get("/attendance-records", ...attendanceRecordsRoute.GET)
  .post("/attendance-records/clock-in", ...attendanceRecordsClockInRoute.POST)
  .post("/attendance-records/clock-out", ...attendanceRecordsClockOutRoute.POST)
  .get("/attendance-records/me", ...attendanceRecordsMeRoute.GET)
  .get("/attendance-records/me/summary", ...attendanceRecordsMeSummaryRoute.GET)
  .get("/attendance-records/overtime-summary", ...attendanceRecordsOvertimeSummaryRoute.GET)
  .post("/audit-event-exports", ...auditEventExportsRoute.POST)
  .get("/audit-events", ...auditEventsRoute.GET)
  .get("/audit-events/:event_id", ...auditEventsEventIdRoute.GET)
  .post("/auth/browser/code", ...authBrowserCodeRoute.POST)
  .post("/auth/browser/token", ...authBrowserTokenRoute.POST)
  .get("/auth/cli/callback", ...authCliCallbackRoute.GET)
  .get("/auth/cli/login", ...authCliLoginRoute.GET)
  .post("/auth/cli/token", ...authCliTokenRoute.POST)
  .post("/auth/identity/login", ...authIdentityLoginRoute.POST)
  .post("/auth/login", ...authLoginRoute.POST)
  .post("/auth/logout", ...authLogoutRoute.POST)
  .post("/auth/refresh", ...authRefreshRoute.POST)
  .get("/batch", ...batchRoute.GET)
  .post("/batch/employee-lifecycle/backfill", ...batchEmployeeLifecycleBackfillRoute.POST)
  .post("/batch/employee-lifecycle/preflight", ...batchEmployeeLifecyclePreflightRoute.POST)
  .post(
    "/batch/employee-lifecycle/process-outbox",
    ...batchEmployeeLifecycleProcessOutboxRoute.POST,
  )
  .post(
    "/batch/employee-lifecycle/rebuild-projections",
    ...batchEmployeeLifecycleRebuildProjectionsRoute.POST,
  )
  .post("/batch/employee-lifecycle/verify", ...batchEmployeeLifecycleVerifyRoute.POST)
  .post("/batch/migrate-password-hashes", ...batchMigratePasswordHashesRoute.POST)
  .post("/bootstrap", ...bootstrapRoute.POST)
  .post("/business-trips", ...businessTripsRoute.POST)
  .get("/business-trips/admin", ...businessTripsAdminRoute.GET)
  .get("/business-trips/me", ...businessTripsMeRoute.GET)
  .get("/business-trips/:id", ...businessTripsIdRoute.GET)
  .put("/business-trips/:id", ...businessTripsIdRoute.PUT)
  .delete("/business-trips/:id", ...businessTripsIdRoute.DELETE)
  .post("/business-trips/:id/approve", ...businessTripsIdApproveRoute.POST)
  .post("/business-trips/:id/reject", ...businessTripsIdRejectRoute.POST)
  .get("/career-applications/me", ...careerApplicationsMeRoute.GET)
  .get("/career-applications/:id", ...careerApplicationsIdRoute.GET)
  .put("/career-applications/:id", ...careerApplicationsIdRoute.PUT)
  .delete("/career-applications/:id", ...careerApplicationsIdRoute.DELETE)

const routePart25 = createRouteApp()
  .get("/career-postings", ...careerPostingsRoute.GET)
  .post("/career-postings", ...careerPostingsRoute.POST)
  .get("/career-postings/:posting_id", ...careerPostingsPostingIdRoute.GET)
  .put("/career-postings/:posting_id", ...careerPostingsPostingIdRoute.PUT)
  .delete("/career-postings/:posting_id", ...careerPostingsPostingIdRoute.DELETE)
  .post("/career-postings/:posting_id/apply", ...careerPostingsPostingIdApplyRoute.POST)
  .get("/career-sheets/me", ...careerSheetsMeRoute.GET)
  .put("/career-sheets/me", ...careerSheetsMeUpdateRoute.PUT)
  .delete("/career-sheets/me", ...careerSheetsMeRoute.DELETE)
  .post("/certificate-requests", ...certificateRequestsRoute.POST)
  .get("/certificate-requests/admin", ...certificateRequestsAdminRoute.GET)
  .get("/certificate-requests/me", ...certificateRequestsMeRoute.GET)
  .get("/certificate-requests/:id", ...certificateRequestsIdRoute.GET)
  .put("/certificate-requests/:id", ...certificateRequestsIdRoute.PUT)
  .delete("/certificate-requests/:id", ...certificateRequestsIdRoute.DELETE)
  .post("/certificate-requests/:id/issue", ...certificateRequestsIdIssueRoute.POST)
  .post("/certificate-requests/:id/reject", ...certificateRequestsIdRejectRoute.POST)
  .get("/certification-definitions", ...certificationDefinitionsRoute.GET)
  .post("/certification-definitions", ...certificationDefinitionsRoute.POST)
  .put("/certification-definitions/:id", ...certificationDefinitionsIdRoute.PUT)
  .get("/commendations", ...commendationsRoute.GET)
  .post("/commendations", ...commendationsRoute.POST)
  .delete("/commendations/:id", ...commendationsIdRoute.DELETE)
  .get("/company-calendar-days", ...companyCalendarDaysRoute.GET)
  .post("/company-calendar-days", ...companyCalendarDaysCreateRoute.POST)
  .delete("/company-calendar-days/:id", ...companyCalendarDaysIdRoute.DELETE)
  .get("/dashboard", ...dashboardRoute.GET)
  .get("/dashboard/management", ...dashboardManagementRoute.GET)
  .get("/decision-records", ...decisionRecordsRoute.GET)
  .post("/decision-records", ...decisionRecordsRoute.POST)
  .get("/decision-records/:id", ...decisionRecordsIdRoute.GET)
  .put("/decision-records/:id", ...decisionRecordsIdRoute.PUT)
  .post("/decision-records/:id/supersede", ...decisionRecordsIdSupersedeRoute.POST)
  .get("/department-budgets", ...departmentBudgetsRoute.GET)
  .post("/department-budgets", ...departmentBudgetsRoute.POST)
  .get("/department-budgets/summary", ...departmentBudgetsSummaryRoute.GET)
  .get("/department-budgets/:id", ...departmentBudgetsIdRoute.GET)
  .patch("/department-budgets/:id", ...departmentBudgetsIdRoute.PATCH)
  .delete("/department-budgets/:id", ...departmentBudgetsIdRoute.DELETE)
  .get("/department-definitions", ...departmentDefinitionsRoute.GET)
  .post("/department-definitions", ...departmentDefinitionsCreateRoute.POST)
  .get("/departments", ...departmentsRoute.GET)
  .post("/departments", ...departmentsRoute.POST)
  .get("/departments/tree", ...departmentsTreeRoute.GET)
  .get("/departments/:code", ...departmentsCodeRoute.GET)
  .put("/departments/:code", ...departmentsCodeRoute.PUT)
  .delete("/departments/:code", ...departmentsCodeRoute.DELETE)
  .get("/departments/:code/members", ...departmentsCodeMembersRoute.GET)

const routePart26 = createRouteApp()
  .get("/directory/employees", ...directoryEmployeesRoute.GET)
  .get("/disciplinary-actions", ...disciplinaryActionsRoute.GET)
  .post("/disciplinary-actions", ...disciplinaryActionsRoute.POST)
  .get("/document-ledger-entries", ...documentLedgerEntriesRoute.GET)
  .post("/document-ledger-entries", ...documentLedgerEntriesRoute.POST)
  .put("/document-ledger-entries/:id", ...documentLedgerEntriesIdRoute.PUT)
  .get("/employee-certifications", ...employeeCertificationsRoute.GET)
  .post("/employee-certifications", ...employeeCertificationsRoute.POST)
  .delete("/employee-certifications/:id", ...employeeCertificationsIdRoute.DELETE)
  .get("/employee-events", ...employeeEventsRoute.GET)
  .post("/employee-events", ...employeeEventsRoute.POST)
  .get("/employee-grades", ...employeeGradesRoute.GET)
  .post("/employee-grades", ...employeeGradesRoute.POST)
  .get("/employee-skills/me", ...employeeSkillsMeRoute.GET)
  .put("/employee-skills/me", ...employeeSkillsMeUpdateRoute.PUT)
  .get("/employee-skills/me/:skill_code", ...employeeSkillsMeSkillCodeRoute.GET)
  .delete("/employee-skills/me/:skill_code", ...employeeSkillsMeSkillCodeRoute.DELETE)
  .get("/employee-work-styles", ...employeeWorkStylesRoute.GET)
  .post("/employee-work-styles", ...employeeWorkStylesRoute.POST)
  .get("/employees", ...employeesRoute.GET)
  .post("/employees", ...employeesRoute.POST)
  .get("/employees/:code", ...employeesCodeRoute.GET)
  .put("/employees/:code", ...employeesCodeRoute.PUT)
  .delete("/employees/:code", ...employeesCodeRoute.DELETE)
  .post("/employees/:code/archive", ...employeesCodeArchiveRoute.POST)
  .get("/employees/:code/lifecycle-events", ...employeesCodeLifecycleEventsRoute.GET)
  .get("/employees/:code/lifecycle-state", ...employeesCodeLifecycleStateRoute.GET)
  .get("/employees/:code/reporting-line", ...employeesCodeReportingLineRoute.GET)
  .get("/evaluation-sheets", ...evaluationSheetsRoute.GET)
  .post("/evaluation-sheets", ...evaluationSheetsCreateRoute.POST)
  .get("/evaluation-sheets/me", ...evaluationSheetsMeRoute.GET)
  .get("/evaluation-sheets/:sheet_id", ...evaluationSheetsSheetIdRoute.GET)
  .put("/evaluation-sheets/:sheet_id/evaluators", ...evaluationSheetsSheetIdEvaluatorsRoute.PUT)
  .post("/evaluation-sheets/:sheet_id/transition", ...evaluationSheetsSheetIdTransitionRoute.POST)
  .get("/evaluation-templates", ...evaluationTemplatesRoute.GET)
  .post("/evaluation-templates", ...evaluationTemplatesCreateRoute.POST)
  .get("/evaluation-templates/:template_id", ...evaluationTemplatesTemplateIdRoute.GET)
  .put("/evaluation-templates/:template_id", ...evaluationTemplatesTemplateIdRoute.PUT)
  .patch("/evaluation-templates/:template_id", ...evaluationTemplatesTemplateIdRoute.PATCH)
  .post("/expenses", ...expensesRoute.POST)
  .get("/expenses/admin", ...expensesAdminRoute.GET)
  .get("/expenses/inbox", ...expensesInboxRoute.GET)
  .get("/expenses/me", ...expensesMeRoute.GET)
  .get("/expenses/:id", ...expensesIdRoute.GET)
  .put("/expenses/:id", ...expensesIdRoute.PUT)
  .delete("/expenses/:id", ...expensesIdRoute.DELETE)
  .post("/expenses/:id/approve", ...expensesIdApproveRoute.POST)
  .post("/expenses/:id/reject", ...expensesIdRejectRoute.POST)

const routePart27 = createRouteApp()
  .post("/family-care-leaves", ...familyCareLeavesRoute.POST)
  .get("/family-care-leaves/admin", ...familyCareLeavesAdminRoute.GET)
  .get("/family-care-leaves/me", ...familyCareLeavesMeRoute.GET)
  .get("/family-care-leaves/:id", ...familyCareLeavesIdRoute.GET)
  .put("/family-care-leaves/:id", ...familyCareLeavesIdRoute.PUT)
  .delete("/family-care-leaves/:id", ...familyCareLeavesIdRoute.DELETE)
  .post("/family-care-leaves/:id/approve", ...familyCareLeavesIdApproveRoute.POST)
  .post("/family-care-leaves/:id/cancel", ...familyCareLeavesIdCancelRoute.POST)
  .get("/features", ...featuresRoute.GET)
  .get("/governance-capabilities", ...governanceCapabilitiesRoute.GET)
  .get("/governance-documents", ...governanceDocumentsRoute.GET)
  .get("/governance-documents/impact", ...governanceDocumentsImpactRoute.GET)
  .post("/governance-documents/sync", ...governanceDocumentsSyncRoute.POST)
  .get("/governance-documents/:code", ...governanceDocumentsCodeRoute.GET)
  .post("/governance-documents/:code/acknowledge", ...governanceDocumentsCodeAcknowledgeRoute.POST)
  .post(
    "/governance-documents/:code/versions/:version/publish",
    ...governanceDocumentsCodeVersionsVersionPublishRoute.POST,
  )
  .post(
    "/governance-documents/:code/versions/:version/review",
    ...governanceDocumentsCodeVersionsVersionReviewRoute.POST,
  )
  .post(
    "/governance-documents/:code/versions/:version/submit-review",
    ...governanceDocumentsCodeVersionsVersionSubmitReviewRoute.POST,
  )
  .get("/governance-org-roles", ...governanceOrgRolesRoute.GET)
  .delete("/governance-org-roles/assignments/:id", ...governanceOrgRolesAssignmentsIdRoute.DELETE)
  .post("/governance-org-roles/:code/assignments", ...governanceOrgRolesCodeAssignmentsRoute.POST)
  .get("/grade-definitions", ...gradeDefinitionsRoute.GET)
  .post("/grade-definitions", ...gradeDefinitionsCreateRoute.POST)
  .put("/grade-definitions/:id", ...gradeDefinitionsIdRoute.PUT)
  .delete("/grade-definitions/:id", ...gradeDefinitionsIdRoute.DELETE)
  .get("/headcount-plans", ...headcountPlansRoute.GET)
  .post("/headcount-plans", ...headcountPlansRoute.POST)
  .put("/headcount-plans/:id", ...headcountPlansIdRoute.PUT)
  .get("/health", ...healthRoute.GET)
  .get("/health-checkups", ...healthCheckupsRoute.GET)
  .post("/health-checkups", ...healthCheckupsRoute.POST)
  .post("/health-checkups/:id/complete", ...healthCheckupsIdCompleteRoute.POST)
  .get("/inbox/counts", ...inboxCountsRoute.GET)
  .get("/it-incidents", ...itIncidentsRoute.GET)
  .post("/it-incidents", ...itIncidentsRoute.POST)
  .post("/it-incidents/:id/resolve", ...itIncidentsIdResolveRoute.POST)
  .get("/job-openings", ...jobOpeningsRoute.GET)
  .post("/job-openings", ...jobOpeningsRoute.POST)
  .get("/job-openings/:job_opening_id", ...jobOpeningsJobOpeningIdRoute.GET)
  .put("/job-openings/:job_opening_id", ...jobOpeningsJobOpeningIdRoute.PUT)
  .get("/job-openings/:job_opening_id/candidates", ...jobOpeningsJobOpeningIdCandidatesRoute.GET)
  .post("/job-openings/:job_opening_id/candidates", ...jobOpeningsJobOpeningIdCandidatesRoute.POST)
  .get("/knowledge-articles", ...knowledgeArticlesRoute.GET)
  .post("/knowledge-articles", ...knowledgeArticlesRoute.POST)
  .get("/knowledge-articles/:id", ...knowledgeArticlesIdRoute.GET)
  .put("/knowledge-articles/:id", ...knowledgeArticlesIdRoute.PUT)
  .delete("/knowledge-articles/:id", ...knowledgeArticlesIdRoute.DELETE)
  .get("/leave-balances", ...leaveBalancesRoute.GET)

const routePart28 = createRouteApp()
  .get("/leave-balances/me", ...leaveBalancesMeRoute.GET)
  .get("/leave-requests", ...leaveRequestsRoute.GET)
  .post("/leave-requests", ...leaveRequestsRoute.POST)
  .get("/leave-requests/admin", ...leaveRequestsAdminRoute.GET)
  .get("/leave-requests/inbox", ...leaveRequestsInboxRoute.GET)
  .get("/leave-requests/me", ...leaveRequestsMeRoute.GET)
  .get("/leave-requests/:id", ...leaveRequestsIdRoute.GET)
  .put("/leave-requests/:id", ...leaveRequestsIdRoute.PUT)
  .delete("/leave-requests/:id", ...leaveRequestsIdRoute.DELETE)
  .post("/leave-requests/:id/approve", ...leaveRequestsIdApproveRoute.POST)
  .post("/leave-requests/:id/reject", ...leaveRequestsIdRejectRoute.POST)
  .post("/life-events", ...lifeEventsRoute.POST)
  .get("/life-events/admin", ...lifeEventsAdminRoute.GET)
  .get("/life-events/me", ...lifeEventsMeRoute.GET)
  .get("/life-events/:id", ...lifeEventsIdRoute.GET)
  .put("/life-events/:id", ...lifeEventsIdRoute.PUT)
  .delete("/life-events/:id", ...lifeEventsIdRoute.DELETE)
  .post("/life-events/:id/approve", ...lifeEventsIdApproveRoute.POST)
  .post("/life-events/:id/reject", ...lifeEventsIdRejectRoute.POST)
  .get("/me", ...meRoute.GET)
  .get("/me/departments", ...meDepartmentsRoute.GET)
  .put("/me/phone", ...mePhoneRoute.PUT)
  .get("/me/reports", ...meReportsRoute.GET)
  .get("/meeting-minutes-records/:id", ...meetingMinutesRecordsIdRoute.GET)
  .put("/meeting-minutes-records/:id", ...meetingMinutesRecordsIdRoute.PUT)
  .get("/meetings", ...meetingsRoute.GET)
  .post("/meetings", ...meetingsRoute.POST)
  .get("/meetings/:code", ...meetingsCodeRoute.GET)
  .put("/meetings/:code", ...meetingsCodeRoute.PUT)
  .post("/meetings/:code/archive", ...meetingsCodeArchiveRoute.POST)
  .get("/meetings/:code/minutes", ...meetingsCodeMinutesRoute.GET)
  .post("/meetings/:code/minutes", ...meetingsCodeMinutesRoute.POST)
  .post("/notifications", ...notificationsRoute.POST)
  .get("/notifications/me", ...notificationsMeRoute.GET)
  .get("/notifications/me/unread-count", ...notificationsMeUnreadCountRoute.GET)
  .post("/notifications/read-all", ...notificationsReadAllRoute.POST)
  .get("/notifications/:id", ...notificationsIdRoute.GET)
  .delete("/notifications/:id", ...notificationsIdRoute.DELETE)
  .post("/notifications/:id/read", ...notificationsIdReadRoute.POST)
  .post("/onboarding-assignments", ...onboardingAssignmentsRoute.POST)
  .get(
    "/onboarding-assignments/employees/:employee_code",
    ...onboardingAssignmentsEmployeesEmployeeCodeRoute.GET,
  )
  .get("/onboarding-assignments/me", ...onboardingAssignmentsMeRoute.GET)
  .get("/onboarding-assignments/:id", ...onboardingAssignmentsIdRoute.GET)
  .put("/onboarding-assignments/:id", ...onboardingAssignmentsIdRoute.PUT)
  .delete("/onboarding-assignments/:id", ...onboardingAssignmentsIdRoute.DELETE)
  .post("/onboarding-tasks/:id/complete", ...onboardingTasksIdCompleteRoute.POST)
  .post("/onboarding-tasks/:id/uncomplete", ...onboardingTasksIdUncompleteRoute.POST)
  .get("/onboarding-templates", ...onboardingTemplatesRoute.GET)

const routePart29 = createRouteApp()
  .post("/onboarding-templates", ...onboardingTemplatesRoute.POST)
  .get("/onboarding-templates/:code", ...onboardingTemplatesCodeRoute.GET)
  .put("/onboarding-templates/:code", ...onboardingTemplatesCodeRoute.PUT)
  .delete("/onboarding-templates/:code", ...onboardingTemplatesCodeRoute.DELETE)
  .put(
    "/onboarding-templates/:code/lifecycle-binding",
    ...onboardingTemplatesCodeLifecycleBindingRoute.PUT,
  )
  .delete(
    "/onboarding-templates/:code/lifecycle-binding",
    ...onboardingTemplatesCodeLifecycleBindingRoute.DELETE,
  )
  .get("/one-on-ones", ...oneOnOnesRoute.GET)
  .post("/one-on-ones", ...oneOnOnesRoute.POST)
  .get("/one-on-ones/me", ...oneOnOnesMeRoute.GET)
  .get("/one-on-ones/:id", ...oneOnOnesIdRoute.GET)
  .put("/one-on-ones/:id", ...oneOnOnesIdRoute.PUT)
  .delete("/one-on-ones/:id", ...oneOnOnesIdRoute.DELETE)
  .get("/partner-contracts", ...partnerContractsRoute.GET)
  .post("/partner-contracts", ...partnerContractsRoute.POST)
  .put("/partner-contracts/:id", ...partnerContractsIdRoute.PUT)
  .get("/partners", ...partnersRoute.GET)
  .post("/partners", ...partnersRoute.POST)
  .get("/partners/:code", ...partnersCodeRoute.GET)
  .put("/partners/:id", ...partnersIdRoute.PUT)
  .post("/partners/:id/archive", ...partnersIdArchiveRoute.POST)
  .get("/performance-goals", ...performanceGoalsRoute.GET)
  .post("/performance-goals", ...performanceGoalsCreateRoute.POST)
  .get("/performance-goals/me", ...performanceGoalsMeRoute.GET)
  .get("/performance-goals/tree", ...performanceGoalsTreeRoute.GET)
  .get("/performance-goals/:goal_id", ...performanceGoalsGoalIdRoute.GET)
  .put("/performance-goals/:goal_id", ...performanceGoalsGoalIdRoute.PUT)
  .delete("/performance-goals/:goal_id", ...performanceGoalsGoalIdRoute.DELETE)
  .post("/performance-goals/:goal_id/evaluations", ...performanceGoalsGoalIdEvaluationsRoute.POST)
  .get("/permission-definitions", ...permissionDefinitionsRoute.GET)

const routePart30 = createRouteApp().get(
  "/personnel-action-requests",
  ...personnelActionRequestsRoute.GET,
)

const routePart31 = createRouteApp().post(
  "/personnel-action-requests",
  ...personnelActionRequestsRoute.POST,
)

const routePart32 = createRouteApp().get(
  "/personnel-action-requests/:id",
  ...personnelActionRequestsIdRoute.GET,
)

const routePart33 = createRouteApp().delete(
  "/personnel-action-requests/:id",
  ...personnelActionRequestsIdRoute.DELETE,
)

const routePart34 = createRouteApp()
  .post("/personnel-actions", ...personnelActionsRoute.POST)
  .post("/personnel-actions/:id/correct", ...personnelActionsIdCorrectRoute.POST)
  .get("/position-definitions", ...positionDefinitionsRoute.GET)
  .post("/position-definitions", ...positionDefinitionsCreateRoute.POST)
  .put("/position-definitions/:id", ...positionDefinitionsIdRoute.PUT)
  .delete("/position-definitions/:id", ...positionDefinitionsIdRoute.DELETE)
  .post("/provisioning/identities", ...provisioningIdentitiesRoute.POST)
  .put("/recruitment-candidates/:id", ...recruitmentCandidatesIdRoute.PUT)
  .post("/recruitment-candidates/:id/advance", ...recruitmentCandidatesIdAdvanceRoute.POST)
  .get("/regulations", ...regulationsRoute.GET)
  .post("/regulations", ...regulationsRoute.POST)
  .get("/regulations/:code", ...regulationsCodeRoute.GET)
  .post("/regulations/:code/archive", ...regulationsCodeArchiveRoute.POST)
  .post("/regulations/:code/versions", ...regulationsCodeVersionsRoute.POST)
  .post("/rental-reservations", ...rentalReservationsRoute.POST)
  .get("/rental-reservations/admin", ...rentalReservationsAdminRoute.GET)
  .get("/rental-reservations/me", ...rentalReservationsMeRoute.GET)
  .get("/rental-reservations/:id", ...rentalReservationsIdRoute.GET)
  .put("/rental-reservations/:id", ...rentalReservationsIdRoute.PUT)
  .delete("/rental-reservations/:id", ...rentalReservationsIdRoute.DELETE)
  .post("/rental-reservations/:id/lend", ...rentalReservationsIdLendRoute.POST)
  .post("/rental-reservations/:id/return", ...rentalReservationsIdReturnRoute.POST)
  .post("/resignations", ...resignationsRoute.POST)
  .get("/resignations/admin", ...resignationsAdminRoute.GET)
  .get("/resignations/me", ...resignationsMeRoute.GET)
  .get("/resignations/:id", ...resignationsIdRoute.GET)
  .put("/resignations/:id", ...resignationsIdRoute.PUT)
  .delete("/resignations/:id", ...resignationsIdRoute.DELETE)
  .post("/resignations/:id/accept", ...resignationsIdAcceptRoute.POST)
  .post("/resignations/:id/reject", ...resignationsIdRejectRoute.POST)
  .get("/review-cycles", ...reviewCyclesRoute.GET)
  .post("/review-cycles", ...reviewCyclesCreateRoute.POST)
  .put("/review-cycles/:cycle_id", ...reviewCyclesCycleIdRoute.PUT)
  .delete("/review-cycles/:cycle_id", ...reviewCyclesCycleIdRoute.DELETE)
  .post("/review-cycles/:cycle_id/close", ...reviewCyclesCycleIdCloseRoute.POST)
  .post("/review-cycles/:cycle_id/disclose", ...reviewCyclesCycleIdDiscloseRoute.POST)
  .post("/review-cycles/:cycle_id/forms/bulk", ...reviewCyclesCycleIdFormsBulkRoute.POST)
  .post("/review-cycles/:cycle_id/open", ...reviewCyclesCycleIdOpenRoute.POST)
  .get("/review-cycles/:cycle_id/policy", ...reviewCyclesCycleIdPolicyRoute.GET)
  .put("/review-cycles/:cycle_id/policy", ...reviewCyclesCycleIdPolicyRoute.PUT)
  .get(
    "/review-cycles/:cycle_id/results/:employee_code",
    ...reviewCyclesCycleIdResultsEmployeeCodeRoute.GET,
  )
  .get("/review-forms", ...reviewFormsRoute.GET)
  .get("/review-forms/me", ...reviewFormsMeRoute.GET)
  .post("/review-forms/:form_id/submit", ...reviewFormsFormIdSubmitRoute.POST)
  .post("/ringi-requests", ...ringiRequestsRoute.POST)
  .get("/ringi-requests/admin", ...ringiRequestsAdminRoute.GET)
  .get("/ringi-requests/inbox", ...ringiRequestsInboxRoute.GET)
  .get("/ringi-requests/me", ...ringiRequestsMeRoute.GET)

const routePart35 = createRouteApp()
  .post("/ringi-requests/:id/approve", ...ringiRequestsIdApproveRoute.POST)
  .post("/ringi-requests/:id/reject", ...ringiRequestsIdRejectRoute.POST)
  .get("/roles", ...rolesRoute.GET)
  .post("/roles", ...rolesRoute.POST)
  .get("/roles/:id", ...rolesIdRoute.GET)
  .patch("/roles/:id", ...rolesIdRoute.PATCH)
  .delete("/roles/:id", ...rolesIdRoute.DELETE)
  .get("/rooms", ...roomsRoute.GET)
  .post("/rooms", ...roomsRoute.POST)
  .get("/rooms/availability", ...roomsAvailabilityRoute.GET)
  .post("/rooms/reservations", ...roomsReservationsRoute.POST)
  .get("/rooms/reservations/me", ...roomsReservationsMeRoute.GET)
  .get("/rooms/reservations/:id", ...roomsReservationsIdRoute.GET)
  .put("/rooms/reservations/:id", ...roomsReservationsIdRoute.PUT)
  .delete("/rooms/reservations/:id", ...roomsReservationsIdRoute.DELETE)
  .get("/rooms/:id", ...roomsIdRoute.GET)
  .put("/rooms/:id", ...roomsIdRoute.PUT)
  .delete("/rooms/:id", ...roomsIdRoute.DELETE)
  .get("/salary-revisions", ...salaryRevisionsRoute.GET)
  .post("/salary-revisions", ...salaryRevisionsRoute.POST)
  .get("/shift-assignments", ...shiftAssignmentsRoute.GET)
  .post("/shift-assignments", ...shiftAssignmentsCreateRoute.POST)
  .get("/shift-assignments/me", ...shiftAssignmentsMeRoute.GET)
  .get("/shift-assignments/:id", ...shiftAssignmentsIdRoute.GET)
  .put("/shift-assignments/:id", ...shiftAssignmentsIdRoute.PUT)
  .delete("/shift-assignments/:id", ...shiftAssignmentsIdRoute.DELETE)
  .post("/shift-assignments/:id/publish", ...shiftAssignmentsIdPublishRoute.POST)
  .get("/shift-patterns", ...shiftPatternsRoute.GET)
  .post("/shift-patterns", ...shiftPatternsCreateRoute.POST)
  .get("/shift-patterns/:id", ...shiftPatternsIdRoute.GET)
  .put("/shift-patterns/:id", ...shiftPatternsIdRoute.PUT)
  .delete("/shift-patterns/:id", ...shiftPatternsIdRoute.DELETE)
  .get("/shift-swap-requests", ...shiftSwapRequestsRoute.GET)
  .post("/shift-swap-requests", ...shiftSwapRequestsRoute.POST)
  .get("/shift-swap-requests/admin", ...shiftSwapRequestsAdminRoute.GET)
  .get("/shift-swap-requests/me", ...shiftSwapRequestsMeRoute.GET)
  .get("/shift-swap-requests/:id", ...shiftSwapRequestsIdRoute.GET)
  .delete("/shift-swap-requests/:id", ...shiftSwapRequestsIdRoute.DELETE)
  .post("/shift-swap-requests/:id/approve", ...shiftSwapRequestsIdApproveRoute.POST)
  .get("/skill-definitions", ...skillDefinitionsRoute.GET)
  .get("/software-licenses", ...softwareLicensesRoute.GET)
  .post("/software-licenses", ...softwareLicensesRoute.POST)
  .put("/software-licenses/:id", ...softwareLicensesIdRoute.PUT)
  .post("/software-licenses/:id/cancel", ...softwareLicensesIdCancelRoute.POST)
  .get("/stocktakes", ...stocktakesRoute.GET)
  .post("/stocktakes", ...stocktakesRoute.POST)
  .get("/stocktakes/:id", ...stocktakesIdRoute.GET)
  .post("/stocktakes/:id/assets/:code/check", ...stocktakesIdAssetsCodeCheckRoute.POST)

const routePart36 = createRouteApp()
  .post("/stocktakes/:id/close", ...stocktakesIdCloseRoute.POST)
  .get("/surveys", ...surveysRoute.GET)
  .post("/surveys", ...surveysCreateRoute.POST)
  .get("/surveys/responses/me", ...surveysResponsesMeRoute.GET)
  .get("/surveys/responses/:response_id", ...surveysResponsesResponseIdRoute.GET)
  .put("/surveys/responses/:response_id", ...surveysResponsesResponseIdRoute.PUT)
  .delete("/surveys/responses/:response_id", ...surveysResponsesResponseIdRoute.DELETE)
  .get("/surveys/:survey_id", ...surveysSurveyIdRoute.GET)
  .put("/surveys/:survey_id", ...surveysSurveyIdRoute.PUT)
  .delete("/surveys/:survey_id", ...surveysSurveyIdRoute.DELETE)
  .post("/surveys/:survey_id/responses", ...surveysSurveyIdResponsesRoute.POST)
  .get("/surveys/:survey_id/summary", ...surveysSurveyIdSummaryRoute.GET)
  .get("/system/v1/health", ...systemV1HealthRoute.GET)
  .get("/thanks-messages", ...thanksMessagesRoute.GET)
  .post("/thanks-messages", ...thanksMessagesRoute.POST)
  .get("/thanks-messages/me", ...thanksMessagesMeRoute.GET)
  .get("/thanks-point-balances/me", ...thanksPointBalancesMeRoute.GET)
  .get("/thanks-point-budgets/me", ...thanksPointBudgetsMeRoute.GET)
  .post("/thanks-redemptions", ...thanksRedemptionsRoute.POST)
  .get("/thanks-redemptions/admin", ...thanksRedemptionsAdminRoute.GET)
  .get("/thanks-redemptions/inbox", ...thanksRedemptionsInboxRoute.GET)
  .get("/thanks-redemptions/me", ...thanksRedemptionsMeRoute.GET)
  .post("/thanks-redemptions/:id/approve", ...thanksRedemptionsIdApproveRoute.POST)
  .post("/thanks-redemptions/:id/reject", ...thanksRedemptionsIdRejectRoute.POST)
  .get("/thanks-rewards", ...thanksRewardsRoute.GET)
  .post("/thanks-rewards", ...thanksRewardsRoute.POST)
  .patch("/thanks-rewards/:id", ...thanksRewardsIdRoute.PATCH)
  .get("/training-courses", ...trainingCoursesRoute.GET)
  .post("/training-courses", ...trainingCoursesCreateRoute.POST)
  .get("/training-courses/:code", ...trainingCoursesCodeRoute.GET)
  .put("/training-courses/:code", ...trainingCoursesCodeRoute.PUT)
  .delete("/training-courses/:code", ...trainingCoursesCodeRoute.DELETE)
  .get("/training-enrollments", ...trainingEnrollmentsRoute.GET)
  .post("/training-enrollments", ...trainingEnrollmentsEnrollRoute.POST)
  .get("/training-enrollments/me", ...trainingEnrollmentsMeRoute.GET)
  .get("/training-enrollments/:id", ...trainingEnrollmentsIdRoute.GET)
  .put("/training-enrollments/:id", ...trainingEnrollmentsIdRoute.PUT)
  .delete("/training-enrollments/:id", ...trainingEnrollmentsIdRoute.DELETE)
  .post("/training-enrollments/:id/complete", ...trainingEnrollmentsIdCompleteRoute.POST)
  .get("/work-accidents", ...workAccidentsRoute.GET)
  .post("/work-accidents", ...workAccidentsRoute.POST)
  .post("/work-accidents/:id/close", ...workAccidentsIdCloseRoute.POST)

export const app = appBase
  .route("/", routePart0)
  .route("/", routePart1)
  .route("/", routePart2)
  .route("/", routePart3)
  .route("/", routePart4)
  .route("/", routePart5)
  .route("/", routePart6)
  .route("/", routePart7)
  .route("/", routePart8)
  .route("/", routePart9)
  .route("/", routePart10)
  .route("/", routePart11)
  .route("/", routePart12)
  .route("/", routePart13)
  .route("/", routePart14)
  .route("/", routePart15)
  .route("/", routePart16)
  .route("/", routePart17)
  .route("/", routePart18)
  .route("/", routePart19)
  .route("/", routePart20)
  .route("/", routePart21)
  .route("/", routePart22)
  .route("/", routePart23)
  .route("/", routePart24)
  .route("/", routePart25)
  .route("/", routePart26)
  .route("/", routePart27)
  .route("/", routePart28)
  .route("/", routePart29)
  .route("/", routePart30)
  .route("/", routePart31)
  .route("/", routePart32)
  .route("/", routePart33)
  .route("/", routePart34)
  .route("/", routePart35)
  .route("/", routePart36)

export type AppType = typeof app

/**
 * routeを小さなHono appへ分割し、hc の型計算を再帰上限内で済ませた Client 型。
 * web/cli はこの型と AppType を type-only で import し、自前の hc<AppType>() に渡す。
 * 実行時に app 本体（全ルート）を消費側のバンドルへ引き込まないよう、ファクトリは置かない。
 */
type ApiClientPart0 = ReturnType<typeof hc<typeof routePart0>>
type ApiClientPart1 = ReturnType<typeof hc<typeof routePart1>>
type ApiClientPart2 = ReturnType<typeof hc<typeof routePart2>>
type ApiClientPart3 = ReturnType<typeof hc<typeof routePart3>>
type ApiClientPart4 = ReturnType<typeof hc<typeof routePart4>>
type ApiClientPart5 = ReturnType<typeof hc<typeof routePart5>>
type ApiClientPart6 = ReturnType<typeof hc<typeof routePart6>>
type ApiClientPart7 = ReturnType<typeof hc<typeof routePart7>>
type ApiClientPart8 = ReturnType<typeof hc<typeof routePart8>>
type ApiClientPart9 = ReturnType<typeof hc<typeof routePart9>>
type ApiClientPart10 = ReturnType<typeof hc<typeof routePart10>>
type ApiClientPart11 = ReturnType<typeof hc<typeof routePart11>>
type ApiClientPart12 = ReturnType<typeof hc<typeof routePart12>>
type ApiClientPart13 = ReturnType<typeof hc<typeof routePart13>>
type ApiClientPart14 = ReturnType<typeof hc<typeof routePart14>>
type ApiClientPart15 = ReturnType<typeof hc<typeof routePart15>>
type ApiClientPart16 = ReturnType<typeof hc<typeof routePart16>>
type ApiClientPart17 = ReturnType<typeof hc<typeof routePart17>>
type ApiClientPart18 = ReturnType<typeof hc<typeof routePart18>>
type ApiClientPart19 = ReturnType<typeof hc<typeof routePart19>>
type ApiClientPart20 = ReturnType<typeof hc<typeof routePart20>>
type ApiClientPart21 = ReturnType<typeof hc<typeof routePart21>>
type ApiClientPart22 = ReturnType<typeof hc<typeof routePart22>>
type ApiClientPart23 = ReturnType<typeof hc<typeof routePart23>>
type ApiClientPart24 = ReturnType<typeof hc<typeof routePart24>>
type ApiClientPart25 = ReturnType<typeof hc<typeof routePart25>>
type ApiClientPart26 = ReturnType<typeof hc<typeof routePart26>>
type ApiClientPart27 = ReturnType<typeof hc<typeof routePart27>>
type ApiClientPart28 = ReturnType<typeof hc<typeof routePart28>>
type ApiClientPart29 = ReturnType<typeof hc<typeof routePart29>>
type ApiClientPart30 = ReturnType<typeof hc<typeof routePart30>>
type ApiClientPart31 = ReturnType<typeof hc<typeof routePart31>>
type ApiClientPart32 = ReturnType<typeof hc<typeof routePart32>>
type ApiClientPart33 = ReturnType<typeof hc<typeof routePart33>>
type ApiClientPart34 = ReturnType<typeof hc<typeof routePart34>>
type ApiClientPart35 = ReturnType<typeof hc<typeof routePart35>>
type ApiClientPart36 = ReturnType<typeof hc<typeof routePart36>>
export type ApiClient = ApiClientPart0 &
  ApiClientPart1 &
  ApiClientPart2 &
  ApiClientPart3 &
  ApiClientPart4 &
  ApiClientPart5 &
  ApiClientPart6 &
  ApiClientPart7 &
  ApiClientPart8 &
  ApiClientPart9 &
  ApiClientPart10 &
  ApiClientPart11 &
  ApiClientPart12 &
  ApiClientPart13 &
  ApiClientPart14 &
  ApiClientPart15 &
  ApiClientPart16 &
  ApiClientPart17 &
  ApiClientPart18 &
  ApiClientPart19 &
  ApiClientPart20 &
  ApiClientPart21 &
  ApiClientPart22 &
  ApiClientPart23 &
  ApiClientPart24 &
  ApiClientPart25 &
  ApiClientPart26 &
  ApiClientPart27 &
  ApiClientPart28 &
  ApiClientPart29 &
  ApiClientPart30 &
  ApiClientPart31 &
  ApiClientPart32 &
  ApiClientPart33 &
  ApiClientPart34 &
  ApiClientPart35 &
  ApiClientPart36
