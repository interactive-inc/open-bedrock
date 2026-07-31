// このファイルは `bun run gen:app` が生成する。手で編集しない。
// ルートを足すときは interface/routes/<URL パス>/route.ts を作り、生成器を再実行する。
// middleware・エラーハンドラ・/health は手書きの app-base.ts が持つ。

import { hc } from "hono/client"
import { appBase } from "@/app-base"
import * as accountsIdResetPasswordRoute from "@/interface/routes/accounts/[id]/reset-password/route"
import * as accountsIdRolesRoleKeyRoute from "@/interface/routes/accounts/[id]/roles/[roleKey]/route"
import * as accountsIdRolesRoute from "@/interface/routes/accounts/[id]/roles/route"
import * as accountsIdStatusRoute from "@/interface/routes/accounts/[id]/status/route"
import * as accountsRoute from "@/interface/routes/accounts/route"
import * as announcementsIdArchiveRoute from "@/interface/routes/announcements/[id]/archive/route"
import * as announcementsIdPublishRoute from "@/interface/routes/announcements/[id]/publish/route"
import * as announcementsIdRoute from "@/interface/routes/announcements/[id]/route"
import * as announcementsRoute from "@/interface/routes/announcements/route"
import * as antisocialChecksIdRoute from "@/interface/routes/antisocial-checks/[id]/route"
import * as antisocialChecksAdminRoute from "@/interface/routes/antisocial-checks/admin/route"
import * as antisocialChecksMeRoute from "@/interface/routes/antisocial-checks/me/route"
import * as antisocialChecksRoute from "@/interface/routes/antisocial-checks/route"
import * as applicationRequestsIdApproveRoute from "@/interface/routes/application-requests/[id]/approve/route"
import * as applicationRequestsIdReassignWorkflowStepRoute from "@/interface/routes/application-requests/[id]/reassign-workflow-step/route"
import * as applicationRequestsIdRejectRoute from "@/interface/routes/application-requests/[id]/reject/route"
import * as applicationRequestsIdResubmitRoute from "@/interface/routes/application-requests/[id]/resubmit/route"
import * as applicationRequestsIdRoute from "@/interface/routes/application-requests/[id]/route"
import * as applicationRequestsAdminRoute from "@/interface/routes/application-requests/admin/route"
import * as applicationRequestsInboxRoute from "@/interface/routes/application-requests/inbox/route"
import * as applicationRequestsMeRoute from "@/interface/routes/application-requests/me/route"
import * as applicationRequestsRoute from "@/interface/routes/application-requests/route"
import * as applicationRequestsSubmitRoute from "@/interface/routes/application-requests/submit-route"
import * as applicationRequestsWorkflowRepairsRoute from "@/interface/routes/application-requests/workflow-repairs/route"
import * as applicationTemplatesCodeRoute from "@/interface/routes/application-templates/[code]/route"
import * as applicationTemplatesCodeWorkflowRoute from "@/interface/routes/application-templates/[code]/workflow/route"
import * as applicationTemplatesCreateRoute from "@/interface/routes/application-templates/create-route"
import * as applicationTemplatesRoute from "@/interface/routes/application-templates/route"
import * as approvalDelegationsIdRoute from "@/interface/routes/approval-delegations/[id]/route"
import * as approvalDelegationsRoute from "@/interface/routes/approval-delegations/route"
import * as assetsCodeDisposeRoute from "@/interface/routes/assets/[code]/dispose/route"
import * as assetsCodeLendRoute from "@/interface/routes/assets/[code]/lend/route"
import * as assetsCodeReturnRoute from "@/interface/routes/assets/[code]/return/route"
import * as assetsCodeRoute from "@/interface/routes/assets/[code]/route"
import * as assetsHoldingsRoute from "@/interface/routes/assets/holdings/route"
import * as assetsLentMeRoute from "@/interface/routes/assets/lent/me/route"
import * as assetsRegisterRoute from "@/interface/routes/assets/register-route"
import * as assetsRoute from "@/interface/routes/assets/route"
import * as attendanceRecordsClockInRoute from "@/interface/routes/attendance-records/clock-in/route"
import * as attendanceRecordsClockOutRoute from "@/interface/routes/attendance-records/clock-out/route"
import * as attendanceRecordsMeRoute from "@/interface/routes/attendance-records/me/route"
import * as attendanceRecordsMeSummaryRoute from "@/interface/routes/attendance-records/me/summary/route"
import * as attendanceRecordsOvertimeSummaryRoute from "@/interface/routes/attendance-records/overtime-summary/route"
import * as attendanceRecordsRoute from "@/interface/routes/attendance-records/route"
import * as auditEventExportsRoute from "@/interface/routes/audit-event-exports/route"
import * as auditEventsEventIdRoute from "@/interface/routes/audit-events/[event_id]/route"
import * as auditEventsRoute from "@/interface/routes/audit-events/route"
import * as authBrowserCodeRoute from "@/interface/routes/auth/browser/code/route"
import * as authBrowserTokenRoute from "@/interface/routes/auth/browser/token/route"
import * as authCliCallbackRoute from "@/interface/routes/auth/cli/callback/route"
import * as authCliLoginRoute from "@/interface/routes/auth/cli/login/route"
import * as authCliTokenRoute from "@/interface/routes/auth/cli/token/route"
import * as authIdentityLoginRoute from "@/interface/routes/auth/identity/login/route"
import * as authLoginRoute from "@/interface/routes/auth/login/route"
import * as authLogoutRoute from "@/interface/routes/auth/logout/route"
import * as authRefreshRoute from "@/interface/routes/auth/refresh/route"
import * as batchEmployeeLifecycleBackfillRoute from "@/interface/routes/batch/employee-lifecycle/backfill/route"
import * as batchEmployeeLifecyclePreflightRoute from "@/interface/routes/batch/employee-lifecycle/preflight/route"
import * as batchEmployeeLifecycleProcessOutboxRoute from "@/interface/routes/batch/employee-lifecycle/process-outbox/route"
import * as batchEmployeeLifecycleRebuildProjectionsRoute from "@/interface/routes/batch/employee-lifecycle/rebuild-projections/route"
import * as batchEmployeeLifecycleVerifyRoute from "@/interface/routes/batch/employee-lifecycle/verify/route"
import * as batchMigratePasswordHashesRoute from "@/interface/routes/batch/migrate-password-hashes/route"
import * as batchRoute from "@/interface/routes/batch/route"
import * as bootstrapRoute from "@/interface/routes/bootstrap/route"
import * as businessTripsIdApproveRoute from "@/interface/routes/business-trips/[id]/approve/route"
import * as businessTripsIdRejectRoute from "@/interface/routes/business-trips/[id]/reject/route"
import * as businessTripsIdRoute from "@/interface/routes/business-trips/[id]/route"
import * as businessTripsAdminRoute from "@/interface/routes/business-trips/admin/route"
import * as businessTripsMeRoute from "@/interface/routes/business-trips/me/route"
import * as businessTripsRoute from "@/interface/routes/business-trips/route"
import * as careerApplicationsIdRoute from "@/interface/routes/career-applications/[id]/route"
import * as careerApplicationsMeRoute from "@/interface/routes/career-applications/me/route"
import * as careerPostingsPostingIdApplyRoute from "@/interface/routes/career-postings/[posting_id]/apply/route"
import * as careerPostingsPostingIdRoute from "@/interface/routes/career-postings/[posting_id]/route"
import * as careerPostingsRoute from "@/interface/routes/career-postings/route"
import * as careerSheetsMeRoute from "@/interface/routes/career-sheets/me/route"
import * as careerSheetsMeUpdateRoute from "@/interface/routes/career-sheets/me/update-route"
import * as certificateRequestsIdIssueRoute from "@/interface/routes/certificate-requests/[id]/issue/route"
import * as certificateRequestsIdRejectRoute from "@/interface/routes/certificate-requests/[id]/reject/route"
import * as certificateRequestsIdRoute from "@/interface/routes/certificate-requests/[id]/route"
import * as certificateRequestsAdminRoute from "@/interface/routes/certificate-requests/admin/route"
import * as certificateRequestsMeRoute from "@/interface/routes/certificate-requests/me/route"
import * as certificateRequestsRoute from "@/interface/routes/certificate-requests/route"
import * as certificationDefinitionsIdRoute from "@/interface/routes/certification-definitions/[id]/route"
import * as certificationDefinitionsRoute from "@/interface/routes/certification-definitions/route"
import * as commendationsIdRoute from "@/interface/routes/commendations/[id]/route"
import * as commendationsRoute from "@/interface/routes/commendations/route"
import * as companyCalendarDaysIdRoute from "@/interface/routes/company-calendar-days/[id]/route"
import * as companyCalendarDaysCreateRoute from "@/interface/routes/company-calendar-days/create-route"
import * as companyCalendarDaysRoute from "@/interface/routes/company-calendar-days/route"
import * as dashboardManagementRoute from "@/interface/routes/dashboard/management/route"
import * as dashboardRoute from "@/interface/routes/dashboard/route"
import * as decisionRecordsIdRoute from "@/interface/routes/decision-records/[id]/route"
import * as decisionRecordsIdSupersedeRoute from "@/interface/routes/decision-records/[id]/supersede/route"
import * as decisionRecordsRoute from "@/interface/routes/decision-records/route"
import * as departmentBudgetsIdRoute from "@/interface/routes/department-budgets/[id]/route"
import * as departmentBudgetsRoute from "@/interface/routes/department-budgets/route"
import * as departmentBudgetsSummaryRoute from "@/interface/routes/department-budgets/summary/route"
import * as departmentsCodeMembersRoute from "@/interface/routes/departments/[code]/members/route"
import * as departmentsCodeRoute from "@/interface/routes/departments/[code]/route"
import * as departmentsRoute from "@/interface/routes/departments/route"
import * as departmentsTreeRoute from "@/interface/routes/departments/tree/route"
import * as directoryEmployeesRoute from "@/interface/routes/directory/employees/route"
import * as disciplinaryActionsRoute from "@/interface/routes/disciplinary-actions/route"
import * as documentLedgerEntriesIdRoute from "@/interface/routes/document-ledger-entries/[id]/route"
import * as documentLedgerEntriesRoute from "@/interface/routes/document-ledger-entries/route"
import * as employeeCertificationsIdRoute from "@/interface/routes/employee-certifications/[id]/route"
import * as employeeCertificationsRoute from "@/interface/routes/employee-certifications/route"
import * as employeeEventsRoute from "@/interface/routes/employee-events/route"
import * as employeeGradesRoute from "@/interface/routes/employee-grades/route"
import * as employeeSkillsMeSkillCodeRoute from "@/interface/routes/employee-skills/me/[skill_code]/route"
import * as employeeSkillsMeRoute from "@/interface/routes/employee-skills/me/route"
import * as employeeSkillsMeUpdateRoute from "@/interface/routes/employee-skills/me/update-route"
import * as employeeWorkStylesRoute from "@/interface/routes/employee-work-styles/route"
import * as employeesCodeArchiveRoute from "@/interface/routes/employees/[code]/archive/route"
import * as employeesCodeLifecycleEventsRoute from "@/interface/routes/employees/[code]/lifecycle-events/route"
import * as employeesCodeLifecycleStateRoute from "@/interface/routes/employees/[code]/lifecycle-state/route"
import * as employeesCodeReportingLineRoute from "@/interface/routes/employees/[code]/reporting-line/route"
import * as employeesCodeRoute from "@/interface/routes/employees/[code]/route"
import * as employeesRoute from "@/interface/routes/employees/route"
import * as expensesIdApproveRoute from "@/interface/routes/expenses/[id]/approve/route"
import * as expensesIdRejectRoute from "@/interface/routes/expenses/[id]/reject/route"
import * as expensesIdRoute from "@/interface/routes/expenses/[id]/route"
import * as expensesAdminRoute from "@/interface/routes/expenses/admin/route"
import * as expensesInboxRoute from "@/interface/routes/expenses/inbox/route"
import * as expensesMeRoute from "@/interface/routes/expenses/me/route"
import * as expensesRoute from "@/interface/routes/expenses/route"
import * as familyCareLeavesIdApproveRoute from "@/interface/routes/family-care-leaves/[id]/approve/route"
import * as familyCareLeavesIdCancelRoute from "@/interface/routes/family-care-leaves/[id]/cancel/route"
import * as familyCareLeavesIdRoute from "@/interface/routes/family-care-leaves/[id]/route"
import * as familyCareLeavesAdminRoute from "@/interface/routes/family-care-leaves/admin/route"
import * as familyCareLeavesMeRoute from "@/interface/routes/family-care-leaves/me/route"
import * as familyCareLeavesRoute from "@/interface/routes/family-care-leaves/route"
import * as governanceCapabilitiesRoute from "@/interface/routes/governance-capabilities/route"
import * as governanceDocumentsCodeAcknowledgeRoute from "@/interface/routes/governance-documents/[code]/acknowledge/route"
import * as governanceDocumentsCodeRoute from "@/interface/routes/governance-documents/[code]/route"
import * as governanceDocumentsCodeVersionsVersionPublishRoute from "@/interface/routes/governance-documents/[code]/versions/[version]/publish/route"
import * as governanceDocumentsCodeVersionsVersionReviewRoute from "@/interface/routes/governance-documents/[code]/versions/[version]/review/route"
import * as governanceDocumentsCodeVersionsVersionSubmitReviewRoute from "@/interface/routes/governance-documents/[code]/versions/[version]/submit-review/route"
import * as governanceDocumentsImpactRoute from "@/interface/routes/governance-documents/impact/route"
import * as governanceDocumentsRoute from "@/interface/routes/governance-documents/route"
import * as governanceDocumentsSyncRoute from "@/interface/routes/governance-documents/sync/route"
import * as governanceOrgRolesCodeAssignmentsRoute from "@/interface/routes/governance-org-roles/[code]/assignments/route"
import * as governanceOrgRolesAssignmentsIdRoute from "@/interface/routes/governance-org-roles/assignments/[id]/route"
import * as governanceOrgRolesRoute from "@/interface/routes/governance-org-roles/route"
import * as gradeDefinitionsIdRoute from "@/interface/routes/grade-definitions/[id]/route"
import * as gradeDefinitionsCreateRoute from "@/interface/routes/grade-definitions/create-route"
import * as gradeDefinitionsRoute from "@/interface/routes/grade-definitions/route"
import * as headcountPlansIdRoute from "@/interface/routes/headcount-plans/[id]/route"
import * as headcountPlansRoute from "@/interface/routes/headcount-plans/route"
import * as healthCheckupsIdCompleteRoute from "@/interface/routes/health-checkups/[id]/complete/route"
import * as healthCheckupsRoute from "@/interface/routes/health-checkups/route"
import * as inboxCountsRoute from "@/interface/routes/inbox/counts/route"
import * as itIncidentsIdResolveRoute from "@/interface/routes/it-incidents/[id]/resolve/route"
import * as itIncidentsRoute from "@/interface/routes/it-incidents/route"
import * as jobOpeningsJobOpeningIdCandidatesRoute from "@/interface/routes/job-openings/[job_opening_id]/candidates/route"
import * as jobOpeningsJobOpeningIdRoute from "@/interface/routes/job-openings/[job_opening_id]/route"
import * as jobOpeningsRoute from "@/interface/routes/job-openings/route"
import * as knowledgeArticlesIdRoute from "@/interface/routes/knowledge-articles/[id]/route"
import * as knowledgeArticlesRoute from "@/interface/routes/knowledge-articles/route"
import * as leaveBalancesMeRoute from "@/interface/routes/leave-balances/me/route"
import * as leaveBalancesRoute from "@/interface/routes/leave-balances/route"
import * as leaveRequestsIdApproveRoute from "@/interface/routes/leave-requests/[id]/approve/route"
import * as leaveRequestsIdRejectRoute from "@/interface/routes/leave-requests/[id]/reject/route"
import * as leaveRequestsIdRoute from "@/interface/routes/leave-requests/[id]/route"
import * as leaveRequestsAdminRoute from "@/interface/routes/leave-requests/admin/route"
import * as leaveRequestsInboxRoute from "@/interface/routes/leave-requests/inbox/route"
import * as leaveRequestsMeRoute from "@/interface/routes/leave-requests/me/route"
import * as leaveRequestsRoute from "@/interface/routes/leave-requests/route"
import * as lifeEventsIdApproveRoute from "@/interface/routes/life-events/[id]/approve/route"
import * as lifeEventsIdRejectRoute from "@/interface/routes/life-events/[id]/reject/route"
import * as lifeEventsIdRoute from "@/interface/routes/life-events/[id]/route"
import * as lifeEventsAdminRoute from "@/interface/routes/life-events/admin/route"
import * as lifeEventsMeRoute from "@/interface/routes/life-events/me/route"
import * as lifeEventsRoute from "@/interface/routes/life-events/route"
import * as meDepartmentsRoute from "@/interface/routes/me/departments/route"
import * as mePhoneRoute from "@/interface/routes/me/phone/route"
import * as meReportsRoute from "@/interface/routes/me/reports/route"
import * as meRoute from "@/interface/routes/me/route"
import * as meetingMinutesRecordsIdRoute from "@/interface/routes/meeting-minutes-records/[id]/route"
import * as meetingsCodeArchiveRoute from "@/interface/routes/meetings/[code]/archive/route"
import * as meetingsCodeMinutesRoute from "@/interface/routes/meetings/[code]/minutes/route"
import * as meetingsCodeRoute from "@/interface/routes/meetings/[code]/route"
import * as meetingsRoute from "@/interface/routes/meetings/route"
import * as notificationsIdReadRoute from "@/interface/routes/notifications/[id]/read/route"
import * as notificationsIdRoute from "@/interface/routes/notifications/[id]/route"
import * as notificationsMeRoute from "@/interface/routes/notifications/me/route"
import * as notificationsMeUnreadCountRoute from "@/interface/routes/notifications/me/unread-count/route"
import * as notificationsReadAllRoute from "@/interface/routes/notifications/read-all/route"
import * as notificationsRoute from "@/interface/routes/notifications/route"
import * as onboardingAssignmentsIdRoute from "@/interface/routes/onboarding-assignments/[id]/route"
import * as onboardingAssignmentsEmployeesEmployeeCodeRoute from "@/interface/routes/onboarding-assignments/employees/[employee_code]/route"
import * as onboardingAssignmentsMeRoute from "@/interface/routes/onboarding-assignments/me/route"
import * as onboardingAssignmentsRoute from "@/interface/routes/onboarding-assignments/route"
import * as onboardingTasksIdCompleteRoute from "@/interface/routes/onboarding-tasks/[id]/complete/route"
import * as onboardingTasksIdUncompleteRoute from "@/interface/routes/onboarding-tasks/[id]/uncomplete/route"
import * as onboardingTemplatesCodeLifecycleBindingRoute from "@/interface/routes/onboarding-templates/[code]/lifecycle-binding/route"
import * as onboardingTemplatesCodeRoute from "@/interface/routes/onboarding-templates/[code]/route"
import * as onboardingTemplatesRoute from "@/interface/routes/onboarding-templates/route"
import * as oneOnOnesIdRoute from "@/interface/routes/one-on-ones/[id]/route"
import * as oneOnOnesMeRoute from "@/interface/routes/one-on-ones/me/route"
import * as oneOnOnesRoute from "@/interface/routes/one-on-ones/route"
import * as partnerContractsIdRoute from "@/interface/routes/partner-contracts/[id]/route"
import * as partnerContractsRoute from "@/interface/routes/partner-contracts/route"
import * as partnersCodeRoute from "@/interface/routes/partners/[code]/route"
import * as partnersIdArchiveRoute from "@/interface/routes/partners/[id]/archive/route"
import * as partnersIdRoute from "@/interface/routes/partners/[id]/route"
import * as partnersRoute from "@/interface/routes/partners/route"
import * as performanceGoalsGoalIdEvaluationsRoute from "@/interface/routes/performance-goals/[goal_id]/evaluations/route"
import * as performanceGoalsGoalIdRoute from "@/interface/routes/performance-goals/[goal_id]/route"
import * as performanceGoalsCreateRoute from "@/interface/routes/performance-goals/create-route"
import * as performanceGoalsMeRoute from "@/interface/routes/performance-goals/me/route"
import * as performanceGoalsRoute from "@/interface/routes/performance-goals/route"
import * as performanceGoalsTreeRoute from "@/interface/routes/performance-goals/tree/route"
import * as permissionDefinitionsRoute from "@/interface/routes/permission-definitions/route"
import * as personnelActionRequestsIdRoute from "@/interface/routes/personnel-action-requests/[id]/route"
import * as personnelActionRequestsRoute from "@/interface/routes/personnel-action-requests/route"
import * as personnelActionsIdCorrectRoute from "@/interface/routes/personnel-actions/[id]/correct/route"
import * as personnelActionsRoute from "@/interface/routes/personnel-actions/route"
import * as positionDefinitionsIdRoute from "@/interface/routes/position-definitions/[id]/route"
import * as positionDefinitionsCreateRoute from "@/interface/routes/position-definitions/create-route"
import * as positionDefinitionsRoute from "@/interface/routes/position-definitions/route"
import * as provisioningIdentitiesRoute from "@/interface/routes/provisioning/identities/route"
import * as recruitmentCandidatesIdAdvanceRoute from "@/interface/routes/recruitment-candidates/[id]/advance/route"
import * as recruitmentCandidatesIdRoute from "@/interface/routes/recruitment-candidates/[id]/route"
import * as regulationsCodeArchiveRoute from "@/interface/routes/regulations/[code]/archive/route"
import * as regulationsCodeRoute from "@/interface/routes/regulations/[code]/route"
import * as regulationsCodeVersionsRoute from "@/interface/routes/regulations/[code]/versions/route"
import * as regulationsRoute from "@/interface/routes/regulations/route"
import * as rentalReservationsIdLendRoute from "@/interface/routes/rental-reservations/[id]/lend/route"
import * as rentalReservationsIdReturnRoute from "@/interface/routes/rental-reservations/[id]/return/route"
import * as rentalReservationsIdRoute from "@/interface/routes/rental-reservations/[id]/route"
import * as rentalReservationsAdminRoute from "@/interface/routes/rental-reservations/admin/route"
import * as rentalReservationsMeRoute from "@/interface/routes/rental-reservations/me/route"
import * as rentalReservationsRoute from "@/interface/routes/rental-reservations/route"
import * as resignationsIdAcceptRoute from "@/interface/routes/resignations/[id]/accept/route"
import * as resignationsIdRejectRoute from "@/interface/routes/resignations/[id]/reject/route"
import * as resignationsIdRoute from "@/interface/routes/resignations/[id]/route"
import * as resignationsAdminRoute from "@/interface/routes/resignations/admin/route"
import * as resignationsMeRoute from "@/interface/routes/resignations/me/route"
import * as resignationsRoute from "@/interface/routes/resignations/route"
import * as reviewCyclesCycleIdCloseRoute from "@/interface/routes/review-cycles/[cycle_id]/close/route"
import * as reviewCyclesCycleIdDiscloseRoute from "@/interface/routes/review-cycles/[cycle_id]/disclose/route"
import * as reviewCyclesCycleIdFormsBulkRoute from "@/interface/routes/review-cycles/[cycle_id]/forms/bulk/route"
import * as reviewCyclesCycleIdOpenRoute from "@/interface/routes/review-cycles/[cycle_id]/open/route"
import * as reviewCyclesCycleIdPolicyRoute from "@/interface/routes/review-cycles/[cycle_id]/policy/route"
import * as reviewCyclesCycleIdResultsEmployeeCodeRoute from "@/interface/routes/review-cycles/[cycle_id]/results/[employee_code]/route"
import * as reviewCyclesCycleIdRoute from "@/interface/routes/review-cycles/[cycle_id]/route"
import * as reviewCyclesCreateRoute from "@/interface/routes/review-cycles/create-route"
import * as reviewCyclesRoute from "@/interface/routes/review-cycles/route"
import * as reviewFormsFormIdSubmitRoute from "@/interface/routes/review-forms/[form_id]/submit/route"
import * as reviewFormsMeRoute from "@/interface/routes/review-forms/me/route"
import * as reviewFormsRoute from "@/interface/routes/review-forms/route"
import * as ringiRequestsIdApproveRoute from "@/interface/routes/ringi-requests/[id]/approve/route"
import * as ringiRequestsIdRejectRoute from "@/interface/routes/ringi-requests/[id]/reject/route"
import * as ringiRequestsAdminRoute from "@/interface/routes/ringi-requests/admin/route"
import * as ringiRequestsInboxRoute from "@/interface/routes/ringi-requests/inbox/route"
import * as ringiRequestsMeRoute from "@/interface/routes/ringi-requests/me/route"
import * as ringiRequestsRoute from "@/interface/routes/ringi-requests/route"
import * as rolesIdRoute from "@/interface/routes/roles/[id]/route"
import * as rolesRoute from "@/interface/routes/roles/route"
import * as roomsIdRoute from "@/interface/routes/rooms/[id]/route"
import * as roomsAvailabilityRoute from "@/interface/routes/rooms/availability/route"
import * as roomsReservationsIdRoute from "@/interface/routes/rooms/reservations/[id]/route"
import * as roomsReservationsMeRoute from "@/interface/routes/rooms/reservations/me/route"
import * as roomsReservationsRoute from "@/interface/routes/rooms/reservations/route"
import * as roomsRoute from "@/interface/routes/rooms/route"
import * as salaryRevisionsRoute from "@/interface/routes/salary-revisions/route"
import * as shiftAssignmentsIdPublishRoute from "@/interface/routes/shift-assignments/[id]/publish/route"
import * as shiftAssignmentsIdRoute from "@/interface/routes/shift-assignments/[id]/route"
import * as shiftAssignmentsCreateRoute from "@/interface/routes/shift-assignments/create-route"
import * as shiftAssignmentsMeRoute from "@/interface/routes/shift-assignments/me/route"
import * as shiftAssignmentsRoute from "@/interface/routes/shift-assignments/route"
import * as shiftPatternsIdRoute from "@/interface/routes/shift-patterns/[id]/route"
import * as shiftPatternsCreateRoute from "@/interface/routes/shift-patterns/create-route"
import * as shiftPatternsRoute from "@/interface/routes/shift-patterns/route"
import * as shiftSwapRequestsIdApproveRoute from "@/interface/routes/shift-swap-requests/[id]/approve/route"
import * as shiftSwapRequestsIdRoute from "@/interface/routes/shift-swap-requests/[id]/route"
import * as shiftSwapRequestsAdminRoute from "@/interface/routes/shift-swap-requests/admin/route"
import * as shiftSwapRequestsMeRoute from "@/interface/routes/shift-swap-requests/me/route"
import * as shiftSwapRequestsRoute from "@/interface/routes/shift-swap-requests/route"
import * as skillDefinitionsRoute from "@/interface/routes/skill-definitions/route"
import * as softwareLicensesIdCancelRoute from "@/interface/routes/software-licenses/[id]/cancel/route"
import * as softwareLicensesIdRoute from "@/interface/routes/software-licenses/[id]/route"
import * as softwareLicensesRoute from "@/interface/routes/software-licenses/route"
import * as stocktakesIdAssetsCodeCheckRoute from "@/interface/routes/stocktakes/[id]/assets/[code]/check/route"
import * as stocktakesIdCloseRoute from "@/interface/routes/stocktakes/[id]/close/route"
import * as stocktakesIdRoute from "@/interface/routes/stocktakes/[id]/route"
import * as stocktakesRoute from "@/interface/routes/stocktakes/route"
import * as surveysSurveyIdResponsesRoute from "@/interface/routes/surveys/[survey_id]/responses/route"
import * as surveysSurveyIdRoute from "@/interface/routes/surveys/[survey_id]/route"
import * as surveysSurveyIdSummaryRoute from "@/interface/routes/surveys/[survey_id]/summary/route"
import * as surveysCreateRoute from "@/interface/routes/surveys/create-route"
import * as surveysResponsesResponseIdRoute from "@/interface/routes/surveys/responses/[response_id]/route"
import * as surveysResponsesMeRoute from "@/interface/routes/surveys/responses/me/route"
import * as surveysRoute from "@/interface/routes/surveys/route"
import * as thanksMessagesMeRoute from "@/interface/routes/thanks-messages/me/route"
import * as thanksMessagesRoute from "@/interface/routes/thanks-messages/route"
import * as thanksPointBalancesMeRoute from "@/interface/routes/thanks-point-balances/me/route"
import * as thanksPointBudgetsMeRoute from "@/interface/routes/thanks-point-budgets/me/route"
import * as thanksRedemptionsIdApproveRoute from "@/interface/routes/thanks-redemptions/[id]/approve/route"
import * as thanksRedemptionsIdRejectRoute from "@/interface/routes/thanks-redemptions/[id]/reject/route"
import * as thanksRedemptionsAdminRoute from "@/interface/routes/thanks-redemptions/admin/route"
import * as thanksRedemptionsInboxRoute from "@/interface/routes/thanks-redemptions/inbox/route"
import * as thanksRedemptionsMeRoute from "@/interface/routes/thanks-redemptions/me/route"
import * as thanksRedemptionsRoute from "@/interface/routes/thanks-redemptions/route"
import * as thanksRewardsIdRoute from "@/interface/routes/thanks-rewards/[id]/route"
import * as thanksRewardsRoute from "@/interface/routes/thanks-rewards/route"
import * as trainingCoursesCodeRoute from "@/interface/routes/training-courses/[code]/route"
import * as trainingCoursesCreateRoute from "@/interface/routes/training-courses/create-route"
import * as trainingCoursesRoute from "@/interface/routes/training-courses/route"
import * as trainingEnrollmentsIdCompleteRoute from "@/interface/routes/training-enrollments/[id]/complete/route"
import * as trainingEnrollmentsIdRoute from "@/interface/routes/training-enrollments/[id]/route"
import * as trainingEnrollmentsEnrollRoute from "@/interface/routes/training-enrollments/enroll-route"
import * as trainingEnrollmentsMeRoute from "@/interface/routes/training-enrollments/me/route"
import * as trainingEnrollmentsRoute from "@/interface/routes/training-enrollments/route"
import * as workAccidentsIdCloseRoute from "@/interface/routes/work-accidents/[id]/close/route"
import * as workAccidentsRoute from "@/interface/routes/work-accidents/route"

export const app = appBase
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
  .get("/application-requests", ...applicationRequestsRoute.GET)
  .post("/application-requests", ...applicationRequestsSubmitRoute.POST)
  .get("/application-requests/admin", ...applicationRequestsAdminRoute.GET)
  .get("/application-requests/inbox", ...applicationRequestsInboxRoute.GET)
  .get("/application-requests/me", ...applicationRequestsMeRoute.GET)
  .get("/application-requests/workflow-repairs", ...applicationRequestsWorkflowRepairsRoute.GET)
  .get("/application-requests/:id", ...applicationRequestsIdRoute.GET)
  .put("/application-requests/:id", ...applicationRequestsIdRoute.PUT)
  .delete("/application-requests/:id", ...applicationRequestsIdRoute.DELETE)
  .post("/application-requests/:id/approve", ...applicationRequestsIdApproveRoute.POST)
  .post(
    "/application-requests/:id/reassign-workflow-step",
    ...applicationRequestsIdReassignWorkflowStepRoute.POST,
  )
  .post("/application-requests/:id/reject", ...applicationRequestsIdRejectRoute.POST)
  .post("/application-requests/:id/resubmit", ...applicationRequestsIdResubmitRoute.POST)
  .get("/application-templates", ...applicationTemplatesRoute.GET)
  .post("/application-templates", ...applicationTemplatesCreateRoute.POST)
  .get("/application-templates/:code", ...applicationTemplatesCodeRoute.GET)
  .put("/application-templates/:code", ...applicationTemplatesCodeRoute.PUT)
  .delete("/application-templates/:code", ...applicationTemplatesCodeRoute.DELETE)
  .get("/application-templates/:code/workflow", ...applicationTemplatesCodeWorkflowRoute.GET)
  .put("/application-templates/:code/workflow", ...applicationTemplatesCodeWorkflowRoute.PUT)
  .get("/approval-delegations", ...approvalDelegationsRoute.GET)
  .post("/approval-delegations", ...approvalDelegationsRoute.POST)
  .delete("/approval-delegations/:id", ...approvalDelegationsIdRoute.DELETE)
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
  .get("/departments", ...departmentsRoute.GET)
  .post("/departments", ...departmentsRoute.POST)
  .get("/departments/tree", ...departmentsTreeRoute.GET)
  .get("/departments/:code", ...departmentsCodeRoute.GET)
  .put("/departments/:code", ...departmentsCodeRoute.PUT)
  .delete("/departments/:code", ...departmentsCodeRoute.DELETE)
  .get("/departments/:code/members", ...departmentsCodeMembersRoute.GET)
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
  .post("/expenses", ...expensesRoute.POST)
  .get("/expenses/admin", ...expensesAdminRoute.GET)
  .get("/expenses/inbox", ...expensesInboxRoute.GET)
  .get("/expenses/me", ...expensesMeRoute.GET)
  .get("/expenses/:id", ...expensesIdRoute.GET)
  .put("/expenses/:id", ...expensesIdRoute.PUT)
  .delete("/expenses/:id", ...expensesIdRoute.DELETE)
  .post("/expenses/:id/approve", ...expensesIdApproveRoute.POST)
  .post("/expenses/:id/reject", ...expensesIdRejectRoute.POST)
  .post("/family-care-leaves", ...familyCareLeavesRoute.POST)
  .get("/family-care-leaves/admin", ...familyCareLeavesAdminRoute.GET)
  .get("/family-care-leaves/me", ...familyCareLeavesMeRoute.GET)
  .get("/family-care-leaves/:id", ...familyCareLeavesIdRoute.GET)
  .put("/family-care-leaves/:id", ...familyCareLeavesIdRoute.PUT)
  .delete("/family-care-leaves/:id", ...familyCareLeavesIdRoute.DELETE)
  .post("/family-care-leaves/:id/approve", ...familyCareLeavesIdApproveRoute.POST)
  .post("/family-care-leaves/:id/cancel", ...familyCareLeavesIdCancelRoute.POST)
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
  .get("/personnel-action-requests", ...personnelActionRequestsRoute.GET)
  .post("/personnel-action-requests", ...personnelActionRequestsRoute.POST)
  .get("/personnel-action-requests/:id", ...personnelActionRequestsIdRoute.GET)
  .delete("/personnel-action-requests/:id", ...personnelActionRequestsIdRoute.DELETE)
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

export type AppType = typeof app

/**
 * hc の型計算を api 側（型解決できる環境）で済ませた Client 型。
 * web/cli はこの型と AppType を type-only で import し、自前の hc<AppType>() に渡す。
 * 実行時に app 本体（全ルート）を消費側のバンドルへ引き込まないよう、ファクトリは置かない。
 */
export type ApiClient = ReturnType<typeof hc<AppType>>
