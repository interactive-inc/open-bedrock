// このファイルは `bun run gen:app` が生成する。手で編集しない。
// ルートを足すときは登録済みcontextのinterface/routesへ置き、生成器を再実行する。
// middleware・エラーハンドラは手書きの api/app-base.ts が持つ。

import { hc } from "hono/client"
import { appBase, createRouteApp } from "@/api/app-base"
import * as accountsRoute from "@/api/routes/accounts"
import * as accountsIdResetPasswordRoute from "@/api/routes/accounts.$id.reset-password"
import * as accountsIdRolesRoute from "@/api/routes/accounts.$id.roles"
import * as accountsIdRolesRoleKeyRoute from "@/api/routes/accounts.$id.roles.$roleKey"
import * as accountsIdStatusRoute from "@/api/routes/accounts.$id.status"
import * as applicationRequestsRoute from "@/api/routes/application-requests"
import * as applicationRequestsIdRoute from "@/api/routes/application-requests.$id"
import * as applicationRequestsIdApproveRoute from "@/api/routes/application-requests.$id.approve"
import * as applicationRequestsIdReassignWorkflowStepRoute from "@/api/routes/application-requests.$id.reassign-workflow-step"
import * as applicationRequestsIdRejectRoute from "@/api/routes/application-requests.$id.reject"
import * as applicationRequestsIdResubmitRoute from "@/api/routes/application-requests.$id.resubmit"
import * as applicationRequestsAdminRoute from "@/api/routes/application-requests.admin"
import * as applicationRequestsInboxRoute from "@/api/routes/application-requests.inbox"
import * as applicationRequestsMeRoute from "@/api/routes/application-requests.me"
import * as applicationRequestsWorkflowRepairsRoute from "@/api/routes/application-requests.workflow-repairs"
import * as applicationTemplatesRoute from "@/api/routes/application-templates"
import * as applicationTemplatesCodeRoute from "@/api/routes/application-templates.$code"
import * as applicationTemplatesCodeWorkflowRoute from "@/api/routes/application-templates.$code.workflow"
import * as approvalDelegationsRoute from "@/api/routes/approval-delegations"
import * as approvalDelegationsIdRoute from "@/api/routes/approval-delegations.$id"
import * as attendanceRecordsOvertimeSummaryRoute from "@/api/routes/attendance-records.overtime-summary"
import * as auditEventExportsRoute from "@/api/routes/audit-event-exports"
import * as auditEventsRoute from "@/api/routes/audit-events"
import * as auditEventsEventIdRoute from "@/api/routes/audit-events.$eventId"
import * as authBrowserCodeRoute from "@/api/routes/auth.browser.code"
import * as authBrowserTokenRoute from "@/api/routes/auth.browser.token"
import * as authCliCallbackRoute from "@/api/routes/auth.cli.callback"
import * as authCliLoginRoute from "@/api/routes/auth.cli.login"
import * as authCliTokenRoute from "@/api/routes/auth.cli.token"
import * as authIdentityLoginRoute from "@/api/routes/auth.identity.login"
import * as authLoginRoute from "@/api/routes/auth.login"
import * as authLogoutRoute from "@/api/routes/auth.logout"
import * as authRefreshRoute from "@/api/routes/auth.refresh"
import * as bootstrapRoute from "@/api/routes/bootstrap"
import * as dashboardRoute from "@/api/routes/dashboard"
import * as dashboardManagementRoute from "@/api/routes/dashboard.management"
import * as featuresRoute from "@/api/routes/features"
import * as governanceDocumentsImpactRoute from "@/api/routes/governance-documents.impact"
import * as governanceDocumentsSyncRoute from "@/api/routes/governance-documents.sync"
import * as inboxCountsRoute from "@/api/routes/inbox.counts"
import * as notificationsRoute from "@/api/routes/notifications"
import * as notificationsIdRoute from "@/api/routes/notifications.$id"
import * as notificationsIdReadRoute from "@/api/routes/notifications.$id.read"
import * as notificationsMeRoute from "@/api/routes/notifications.me"
import * as notificationsMeUnreadCountRoute from "@/api/routes/notifications.me.unread-count"
import * as notificationsReadAllRoute from "@/api/routes/notifications.read-all"
import * as permissionDefinitionsRoute from "@/api/routes/permission-definitions"
import * as provisioningIdentitiesRoute from "@/api/routes/provisioning.identities"
import * as announcementsRoute from "@/contexts/announcement/interface/routes/announcements"
import * as announcementsIdRoute from "@/contexts/announcement/interface/routes/announcements.$id"
import * as announcementsIdArchiveRoute from "@/contexts/announcement/interface/routes/announcements.$id.archive"
import * as announcementsIdPublishRoute from "@/contexts/announcement/interface/routes/announcements.$id.publish"
import * as antisocialChecksRoute from "@/contexts/antisocial-check/interface/routes/antisocial-checks"
import * as antisocialChecksIdRoute from "@/contexts/antisocial-check/interface/routes/antisocial-checks.$id"
import * as antisocialChecksAdminRoute from "@/contexts/antisocial-check/interface/routes/antisocial-checks.admin"
import * as antisocialChecksMeRoute from "@/contexts/antisocial-check/interface/routes/antisocial-checks.me"
import * as assetsRoute from "@/contexts/asset/interface/routes/assets"
import * as assetsCodeRoute from "@/contexts/asset/interface/routes/assets.$code"
import * as assetsCodeDisposeRoute from "@/contexts/asset/interface/routes/assets.$code.dispose"
import * as assetsCodeLendRoute from "@/contexts/asset/interface/routes/assets.$code.lend"
import * as assetsCodeReturnRoute from "@/contexts/asset/interface/routes/assets.$code.return"
import * as assetsHoldingsRoute from "@/contexts/asset/interface/routes/assets.holdings"
import * as assetsLentMeRoute from "@/contexts/asset/interface/routes/assets.lent.me"
import * as stocktakesRoute from "@/contexts/asset/interface/routes/stocktakes"
import * as stocktakesIdRoute from "@/contexts/asset/interface/routes/stocktakes.$id"
import * as stocktakesIdAssetsCodeCheckRoute from "@/contexts/asset/interface/routes/stocktakes.$id.assets.$code.check"
import * as stocktakesIdCloseRoute from "@/contexts/asset/interface/routes/stocktakes.$id.close"
import * as attendanceRecordsRoute from "@/contexts/attendance/interface/routes/attendance-records"
import * as attendanceRecordsClockInRoute from "@/contexts/attendance/interface/routes/attendance-records.clock-in"
import * as attendanceRecordsClockOutRoute from "@/contexts/attendance/interface/routes/attendance-records.clock-out"
import * as attendanceRecordsMeRoute from "@/contexts/attendance/interface/routes/attendance-records.me"
import * as attendanceRecordsMeSummaryRoute from "@/contexts/attendance/interface/routes/attendance-records.me.summary"
import * as businessTripsRoute from "@/contexts/business-trip/interface/routes/business-trips"
import * as businessTripsIdRoute from "@/contexts/business-trip/interface/routes/business-trips.$id"
import * as businessTripsIdApproveRoute from "@/contexts/business-trip/interface/routes/business-trips.$id.approve"
import * as businessTripsIdRejectRoute from "@/contexts/business-trip/interface/routes/business-trips.$id.reject"
import * as businessTripsAdminRoute from "@/contexts/business-trip/interface/routes/business-trips.admin"
import * as businessTripsMeRoute from "@/contexts/business-trip/interface/routes/business-trips.me"
import * as careerApplicationsIdRoute from "@/contexts/career/interface/routes/career-applications.$id"
import * as careerApplicationsMeRoute from "@/contexts/career/interface/routes/career-applications.me"
import * as careerPostingsRoute from "@/contexts/career/interface/routes/career-postings"
import * as careerPostingsPostingIdRoute from "@/contexts/career/interface/routes/career-postings.$postingId"
import * as careerPostingsPostingIdApplyRoute from "@/contexts/career/interface/routes/career-postings.$postingId.apply"
import * as careerSheetsMeRoute from "@/contexts/career/interface/routes/career-sheets.me"
import * as certificateRequestsRoute from "@/contexts/certificate-request/interface/routes/certificate-requests"
import * as certificateRequestsIdRoute from "@/contexts/certificate-request/interface/routes/certificate-requests.$id"
import * as certificateRequestsIdIssueRoute from "@/contexts/certificate-request/interface/routes/certificate-requests.$id.issue"
import * as certificateRequestsIdRejectRoute from "@/contexts/certificate-request/interface/routes/certificate-requests.$id.reject"
import * as certificateRequestsAdminRoute from "@/contexts/certificate-request/interface/routes/certificate-requests.admin"
import * as certificateRequestsMeRoute from "@/contexts/certificate-request/interface/routes/certificate-requests.me"
import * as certificationDefinitionsRoute from "@/contexts/certification/interface/routes/certification-definitions"
import * as certificationDefinitionsIdRoute from "@/contexts/certification/interface/routes/certification-definitions.$id"
import * as employeeCertificationsRoute from "@/contexts/certification/interface/routes/employee-certifications"
import * as employeeCertificationsIdRoute from "@/contexts/certification/interface/routes/employee-certifications.$id"
import * as commendationsRoute from "@/contexts/commendation/interface/routes/commendations"
import * as commendationsIdRoute from "@/contexts/commendation/interface/routes/commendations.$id"
import * as companyCalendarDaysRoute from "@/contexts/company-calendar/interface/routes/company-calendar-days"
import * as companyCalendarDaysIdRoute from "@/contexts/company-calendar/interface/routes/company-calendar-days.$id"
import * as batchRoute from "@/contexts/company/interface/routes/batch"
import * as batchEmployeeLifecycleBackfillRoute from "@/contexts/company/interface/routes/batch.employee-lifecycle.backfill"
import * as batchEmployeeLifecyclePreflightRoute from "@/contexts/company/interface/routes/batch.employee-lifecycle.preflight"
import * as batchEmployeeLifecycleProcessOutboxRoute from "@/contexts/company/interface/routes/batch.employee-lifecycle.process-outbox"
import * as batchEmployeeLifecycleRebuildProjectionsRoute from "@/contexts/company/interface/routes/batch.employee-lifecycle.rebuild-projections"
import * as batchEmployeeLifecycleVerifyRoute from "@/contexts/company/interface/routes/batch.employee-lifecycle.verify"
import * as companyV1AccountEmployeeLinksRoute from "@/contexts/company/interface/routes/company.v1.account-employee-links"
import * as companyV1CapabilitiesRoute from "@/contexts/company/interface/routes/company.v1.capabilities"
import * as companyV1DefinitionsRoute from "@/contexts/company/interface/routes/company.v1.definitions"
import * as companyV1EmployeesRoute from "@/contexts/company/interface/routes/company.v1.employees"
import * as companyV1EmploymentsRoute from "@/contexts/company/interface/routes/company.v1.employments"
import * as companyV1OrganizationChangesRoute from "@/contexts/company/interface/routes/company.v1.organization-changes"
import * as companyV1OrganizationSnapshotsRoute from "@/contexts/company/interface/routes/company.v1.organization-snapshots"
import * as companyV1PeopleRoute from "@/contexts/company/interface/routes/company.v1.people"
import * as companyV1PersonnelActionsRoute from "@/contexts/company/interface/routes/company.v1.personnel-actions"
import * as companyV1ProfileRoute from "@/contexts/company/interface/routes/company.v1.profile"
import * as departmentDefinitionsRoute from "@/contexts/company/interface/routes/department-definitions"
import * as departmentsRoute from "@/contexts/company/interface/routes/departments"
import * as departmentsCodeRoute from "@/contexts/company/interface/routes/departments.$code"
import * as departmentsCodeMembersRoute from "@/contexts/company/interface/routes/departments.$code.members"
import * as departmentsTreeRoute from "@/contexts/company/interface/routes/departments.tree"
import * as directoryEmployeesRoute from "@/contexts/company/interface/routes/directory.employees"
import * as employeeEventsRoute from "@/contexts/company/interface/routes/employee-events"
import * as employeeGradesRoute from "@/contexts/company/interface/routes/employee-grades"
import * as employeesRoute from "@/contexts/company/interface/routes/employees"
import * as employeesCodeRoute from "@/contexts/company/interface/routes/employees.$code"
import * as employeesCodeArchiveRoute from "@/contexts/company/interface/routes/employees.$code.archive"
import * as employeesCodeLifecycleEventsRoute from "@/contexts/company/interface/routes/employees.$code.lifecycle-events"
import * as employeesCodeLifecycleStateRoute from "@/contexts/company/interface/routes/employees.$code.lifecycle-state"
import * as employeesCodeReportingLineRoute from "@/contexts/company/interface/routes/employees.$code.reporting-line"
import * as gradeDefinitionsRoute from "@/contexts/company/interface/routes/grade-definitions"
import * as gradeDefinitionsIdRoute from "@/contexts/company/interface/routes/grade-definitions.$id"
import * as meRoute from "@/contexts/company/interface/routes/me"
import * as meDepartmentsRoute from "@/contexts/company/interface/routes/me.departments"
import * as mePhoneRoute from "@/contexts/company/interface/routes/me.phone"
import * as meReportsRoute from "@/contexts/company/interface/routes/me.reports"
import * as personnelActionRequestsRoute from "@/contexts/company/interface/routes/personnel-action-requests"
import * as personnelActionRequestsIdRoute from "@/contexts/company/interface/routes/personnel-action-requests.$id"
import * as personnelActionsRoute from "@/contexts/company/interface/routes/personnel-actions"
import * as personnelActionsIdCorrectRoute from "@/contexts/company/interface/routes/personnel-actions.$id.correct"
import * as positionDefinitionsRoute from "@/contexts/company/interface/routes/position-definitions"
import * as positionDefinitionsIdRoute from "@/contexts/company/interface/routes/position-definitions.$id"
import * as rolesRoute from "@/contexts/company/interface/routes/roles"
import * as rolesIdRoute from "@/contexts/company/interface/routes/roles.$id"
import * as salaryRevisionsRoute from "@/contexts/compensation-change/interface/routes/salary-revisions"
import * as disciplinaryActionsRoute from "@/contexts/disciplinary-action/interface/routes/disciplinary-actions"
import * as documentLedgerEntriesRoute from "@/contexts/document/interface/routes/document-ledger-entries"
import * as documentLedgerEntriesIdRoute from "@/contexts/document/interface/routes/document-ledger-entries.$id"
import * as departmentBudgetsRoute from "@/contexts/expense/interface/routes/department-budgets"
import * as departmentBudgetsIdRoute from "@/contexts/expense/interface/routes/department-budgets.$id"
import * as departmentBudgetsSummaryRoute from "@/contexts/expense/interface/routes/department-budgets.summary"
import * as expensesRoute from "@/contexts/expense/interface/routes/expenses"
import * as expensesIdRoute from "@/contexts/expense/interface/routes/expenses.$id"
import * as expensesIdApproveRoute from "@/contexts/expense/interface/routes/expenses.$id.approve"
import * as expensesIdRejectRoute from "@/contexts/expense/interface/routes/expenses.$id.reject"
import * as expensesAdminRoute from "@/contexts/expense/interface/routes/expenses.admin"
import * as expensesInboxRoute from "@/contexts/expense/interface/routes/expenses.inbox"
import * as expensesMeRoute from "@/contexts/expense/interface/routes/expenses.me"
import * as familyCareLeavesRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves"
import * as familyCareLeavesIdRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves.$id"
import * as familyCareLeavesIdApproveRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves.$id.approve"
import * as familyCareLeavesIdCancelRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves.$id.cancel"
import * as familyCareLeavesAdminRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves.admin"
import * as familyCareLeavesMeRoute from "@/contexts/family-care-leave/interface/routes/family-care-leaves.me"
import * as governanceCapabilitiesRoute from "@/contexts/governance/interface/routes/governance-capabilities"
import * as governanceDocumentsRoute from "@/contexts/governance/interface/routes/governance-documents"
import * as governanceDocumentsCodeRoute from "@/contexts/governance/interface/routes/governance-documents.$code"
import * as governanceDocumentsCodeAcknowledgeRoute from "@/contexts/governance/interface/routes/governance-documents.$code.acknowledge"
import * as governanceDocumentsCodeVersionsVersionPublishRoute from "@/contexts/governance/interface/routes/governance-documents.$code.versions.$version.publish"
import * as governanceDocumentsCodeVersionsVersionReviewRoute from "@/contexts/governance/interface/routes/governance-documents.$code.versions.$version.review"
import * as governanceDocumentsCodeVersionsVersionSubmitReviewRoute from "@/contexts/governance/interface/routes/governance-documents.$code.versions.$version.submit-review"
import * as governanceOrgRolesRoute from "@/contexts/governance/interface/routes/governance-org-roles"
import * as governanceOrgRolesCodeAssignmentsRoute from "@/contexts/governance/interface/routes/governance-org-roles.$code.assignments"
import * as governanceOrgRolesAssignmentsIdRoute from "@/contexts/governance/interface/routes/governance-org-roles.assignments.$id"
import * as headcountPlansRoute from "@/contexts/headcount-plan/interface/routes/headcount-plans"
import * as headcountPlansIdRoute from "@/contexts/headcount-plan/interface/routes/headcount-plans.$id"
import * as healthCheckupsRoute from "@/contexts/health-checkup/interface/routes/health-checkups"
import * as healthCheckupsIdCompleteRoute from "@/contexts/health-checkup/interface/routes/health-checkups.$id.complete"
import * as itIncidentsRoute from "@/contexts/it-incident/interface/routes/it-incidents"
import * as itIncidentsIdResolveRoute from "@/contexts/it-incident/interface/routes/it-incidents.$id.resolve"
import * as knowledgeArticlesRoute from "@/contexts/knowledge/interface/routes/knowledge-articles"
import * as knowledgeArticlesIdRoute from "@/contexts/knowledge/interface/routes/knowledge-articles.$id"
import * as leaveBalancesRoute from "@/contexts/leave/interface/routes/leave-balances"
import * as leaveBalancesMeRoute from "@/contexts/leave/interface/routes/leave-balances.me"
import * as leaveRequestsRoute from "@/contexts/leave/interface/routes/leave-requests"
import * as leaveRequestsIdRoute from "@/contexts/leave/interface/routes/leave-requests.$id"
import * as leaveRequestsIdApproveRoute from "@/contexts/leave/interface/routes/leave-requests.$id.approve"
import * as leaveRequestsIdRejectRoute from "@/contexts/leave/interface/routes/leave-requests.$id.reject"
import * as leaveRequestsAdminRoute from "@/contexts/leave/interface/routes/leave-requests.admin"
import * as leaveRequestsInboxRoute from "@/contexts/leave/interface/routes/leave-requests.inbox"
import * as leaveRequestsMeRoute from "@/contexts/leave/interface/routes/leave-requests.me"
import * as lifeEventsRoute from "@/contexts/life-event/interface/routes/life-events"
import * as lifeEventsIdRoute from "@/contexts/life-event/interface/routes/life-events.$id"
import * as lifeEventsIdApproveRoute from "@/contexts/life-event/interface/routes/life-events.$id.approve"
import * as lifeEventsIdRejectRoute from "@/contexts/life-event/interface/routes/life-events.$id.reject"
import * as lifeEventsAdminRoute from "@/contexts/life-event/interface/routes/life-events.admin"
import * as lifeEventsMeRoute from "@/contexts/life-event/interface/routes/life-events.me"
import * as decisionRecordsRoute from "@/contexts/meeting/interface/routes/decision-records"
import * as decisionRecordsIdRoute from "@/contexts/meeting/interface/routes/decision-records.$id"
import * as decisionRecordsIdSupersedeRoute from "@/contexts/meeting/interface/routes/decision-records.$id.supersede"
import * as meetingMinutesRecordsIdRoute from "@/contexts/meeting/interface/routes/meeting-minutes-records.$id"
import * as meetingsRoute from "@/contexts/meeting/interface/routes/meetings"
import * as meetingsCodeRoute from "@/contexts/meeting/interface/routes/meetings.$code"
import * as meetingsCodeArchiveRoute from "@/contexts/meeting/interface/routes/meetings.$code.archive"
import * as meetingsCodeMinutesRoute from "@/contexts/meeting/interface/routes/meetings.$code.minutes"
import * as onboardingAssignmentsRoute from "@/contexts/onboarding/interface/routes/onboarding-assignments"
import * as onboardingAssignmentsIdRoute from "@/contexts/onboarding/interface/routes/onboarding-assignments.$id"
import * as onboardingAssignmentsEmployeesEmployeeCodeRoute from "@/contexts/onboarding/interface/routes/onboarding-assignments.employees.$employeeCode"
import * as onboardingAssignmentsMeRoute from "@/contexts/onboarding/interface/routes/onboarding-assignments.me"
import * as onboardingTasksIdCompleteRoute from "@/contexts/onboarding/interface/routes/onboarding-tasks.$id.complete"
import * as onboardingTasksIdUncompleteRoute from "@/contexts/onboarding/interface/routes/onboarding-tasks.$id.uncomplete"
import * as onboardingTemplatesRoute from "@/contexts/onboarding/interface/routes/onboarding-templates"
import * as onboardingTemplatesCodeRoute from "@/contexts/onboarding/interface/routes/onboarding-templates.$code"
import * as onboardingTemplatesCodeLifecycleBindingRoute from "@/contexts/onboarding/interface/routes/onboarding-templates.$code.lifecycle-binding"
import * as oneOnOnesRoute from "@/contexts/one-on-one/interface/routes/one-on-ones"
import * as oneOnOnesIdRoute from "@/contexts/one-on-one/interface/routes/one-on-ones.$id"
import * as oneOnOnesMeRoute from "@/contexts/one-on-one/interface/routes/one-on-ones.me"
import * as partnerContractsRoute from "@/contexts/partner/interface/routes/partner-contracts"
import * as partnerContractsIdRoute from "@/contexts/partner/interface/routes/partner-contracts.$id"
import * as partnersRoute from "@/contexts/partner/interface/routes/partners"
import * as partnersCodeRoute from "@/contexts/partner/interface/routes/partners.$code"
import * as partnersIdRoute from "@/contexts/partner/interface/routes/partners.$id"
import * as partnersIdArchiveRoute from "@/contexts/partner/interface/routes/partners.$id.archive"
import * as evaluationSheetsRoute from "@/contexts/performance-review/interface/routes/evaluation-sheets"
import * as evaluationSheetsSheetIdRoute from "@/contexts/performance-review/interface/routes/evaluation-sheets.$sheetId"
import * as evaluationSheetsSheetIdEvaluatorsRoute from "@/contexts/performance-review/interface/routes/evaluation-sheets.$sheetId.evaluators"
import * as evaluationSheetsSheetIdTransitionRoute from "@/contexts/performance-review/interface/routes/evaluation-sheets.$sheetId.transition"
import * as evaluationSheetsMeRoute from "@/contexts/performance-review/interface/routes/evaluation-sheets.me"
import * as evaluationTemplatesRoute from "@/contexts/performance-review/interface/routes/evaluation-templates"
import * as evaluationTemplatesTemplateIdRoute from "@/contexts/performance-review/interface/routes/evaluation-templates.$templateId"
import * as performanceGoalsRoute from "@/contexts/performance-review/interface/routes/performance-goals"
import * as performanceGoalsGoalIdRoute from "@/contexts/performance-review/interface/routes/performance-goals.$goalId"
import * as performanceGoalsGoalIdEvaluationsRoute from "@/contexts/performance-review/interface/routes/performance-goals.$goalId.evaluations"
import * as performanceGoalsMeRoute from "@/contexts/performance-review/interface/routes/performance-goals.me"
import * as performanceGoalsTreeRoute from "@/contexts/performance-review/interface/routes/performance-goals.tree"
import * as reviewCyclesRoute from "@/contexts/performance-review/interface/routes/review-cycles"
import * as reviewCyclesCycleIdRoute from "@/contexts/performance-review/interface/routes/review-cycles.$cycleId"
import * as reviewCyclesCycleIdCloseRoute from "@/contexts/performance-review/interface/routes/review-cycles.$cycleId.close"
import * as reviewCyclesCycleIdDiscloseRoute from "@/contexts/performance-review/interface/routes/review-cycles.$cycleId.disclose"
import * as reviewCyclesCycleIdFormsBulkRoute from "@/contexts/performance-review/interface/routes/review-cycles.$cycleId.forms.bulk"
import * as reviewCyclesCycleIdOpenRoute from "@/contexts/performance-review/interface/routes/review-cycles.$cycleId.open"
import * as reviewCyclesCycleIdPolicyRoute from "@/contexts/performance-review/interface/routes/review-cycles.$cycleId.policy"
import * as reviewCyclesCycleIdResultsEmployeeCodeRoute from "@/contexts/performance-review/interface/routes/review-cycles.$cycleId.results.$employeeCode"
import * as reviewFormsRoute from "@/contexts/performance-review/interface/routes/review-forms"
import * as reviewFormsFormIdSubmitRoute from "@/contexts/performance-review/interface/routes/review-forms.$formId.submit"
import * as reviewFormsMeRoute from "@/contexts/performance-review/interface/routes/review-forms.me"
import * as jobOpeningsRoute from "@/contexts/recruitment/interface/routes/job-openings"
import * as jobOpeningsJobOpeningIdRoute from "@/contexts/recruitment/interface/routes/job-openings.$jobOpeningId"
import * as jobOpeningsJobOpeningIdCandidatesRoute from "@/contexts/recruitment/interface/routes/job-openings.$jobOpeningId.candidates"
import * as recruitmentCandidatesIdRoute from "@/contexts/recruitment/interface/routes/recruitment-candidates.$id"
import * as recruitmentCandidatesIdAdvanceRoute from "@/contexts/recruitment/interface/routes/recruitment-candidates.$id.advance"
import * as regulationsRoute from "@/contexts/regulation/interface/routes/regulations"
import * as regulationsCodeRoute from "@/contexts/regulation/interface/routes/regulations.$code"
import * as regulationsCodeArchiveRoute from "@/contexts/regulation/interface/routes/regulations.$code.archive"
import * as regulationsCodeVersionsRoute from "@/contexts/regulation/interface/routes/regulations.$code.versions"
import * as rentalReservationsRoute from "@/contexts/rental/interface/routes/rental-reservations"
import * as rentalReservationsIdRoute from "@/contexts/rental/interface/routes/rental-reservations.$id"
import * as rentalReservationsIdLendRoute from "@/contexts/rental/interface/routes/rental-reservations.$id.lend"
import * as rentalReservationsIdReturnRoute from "@/contexts/rental/interface/routes/rental-reservations.$id.return"
import * as rentalReservationsAdminRoute from "@/contexts/rental/interface/routes/rental-reservations.admin"
import * as rentalReservationsMeRoute from "@/contexts/rental/interface/routes/rental-reservations.me"
import * as resignationsRoute from "@/contexts/resignation/interface/routes/resignations"
import * as resignationsIdRoute from "@/contexts/resignation/interface/routes/resignations.$id"
import * as resignationsIdAcceptRoute from "@/contexts/resignation/interface/routes/resignations.$id.accept"
import * as resignationsIdRejectRoute from "@/contexts/resignation/interface/routes/resignations.$id.reject"
import * as resignationsAdminRoute from "@/contexts/resignation/interface/routes/resignations.admin"
import * as resignationsMeRoute from "@/contexts/resignation/interface/routes/resignations.me"
import * as ringiRequestsRoute from "@/contexts/ringi/interface/routes/ringi-requests"
import * as ringiRequestsIdApproveRoute from "@/contexts/ringi/interface/routes/ringi-requests.$id.approve"
import * as ringiRequestsIdRejectRoute from "@/contexts/ringi/interface/routes/ringi-requests.$id.reject"
import * as ringiRequestsAdminRoute from "@/contexts/ringi/interface/routes/ringi-requests.admin"
import * as ringiRequestsInboxRoute from "@/contexts/ringi/interface/routes/ringi-requests.inbox"
import * as ringiRequestsMeRoute from "@/contexts/ringi/interface/routes/ringi-requests.me"
import * as roomsRoute from "@/contexts/room/interface/routes/rooms"
import * as roomsIdRoute from "@/contexts/room/interface/routes/rooms.$id"
import * as roomsAvailabilityRoute from "@/contexts/room/interface/routes/rooms.availability"
import * as roomsReservationsRoute from "@/contexts/room/interface/routes/rooms.reservations"
import * as roomsReservationsIdRoute from "@/contexts/room/interface/routes/rooms.reservations.$id"
import * as roomsReservationsMeRoute from "@/contexts/room/interface/routes/rooms.reservations.me"
import * as shiftAssignmentsRoute from "@/contexts/shift/interface/routes/shift-assignments"
import * as shiftAssignmentsIdRoute from "@/contexts/shift/interface/routes/shift-assignments.$id"
import * as shiftAssignmentsIdPublishRoute from "@/contexts/shift/interface/routes/shift-assignments.$id.publish"
import * as shiftAssignmentsMeRoute from "@/contexts/shift/interface/routes/shift-assignments.me"
import * as shiftPatternsRoute from "@/contexts/shift/interface/routes/shift-patterns"
import * as shiftPatternsIdRoute from "@/contexts/shift/interface/routes/shift-patterns.$id"
import * as shiftSwapRequestsRoute from "@/contexts/shift/interface/routes/shift-swap-requests"
import * as shiftSwapRequestsIdRoute from "@/contexts/shift/interface/routes/shift-swap-requests.$id"
import * as shiftSwapRequestsIdApproveRoute from "@/contexts/shift/interface/routes/shift-swap-requests.$id.approve"
import * as shiftSwapRequestsAdminRoute from "@/contexts/shift/interface/routes/shift-swap-requests.admin"
import * as shiftSwapRequestsMeRoute from "@/contexts/shift/interface/routes/shift-swap-requests.me"
import * as employeeSkillsMeRoute from "@/contexts/skill/interface/routes/employee-skills.me"
import * as employeeSkillsMeSkillCodeRoute from "@/contexts/skill/interface/routes/employee-skills.me.$skillCode"
import * as skillDefinitionsRoute from "@/contexts/skill/interface/routes/skill-definitions"
import * as softwareLicensesRoute from "@/contexts/software-license/interface/routes/software-licenses"
import * as softwareLicensesIdRoute from "@/contexts/software-license/interface/routes/software-licenses.$id"
import * as softwareLicensesIdCancelRoute from "@/contexts/software-license/interface/routes/software-licenses.$id.cancel"
import * as surveysRoute from "@/contexts/survey/interface/routes/surveys"
import * as surveysSurveyIdRoute from "@/contexts/survey/interface/routes/surveys.$surveyId"
import * as surveysSurveyIdResponsesRoute from "@/contexts/survey/interface/routes/surveys.$surveyId.responses"
import * as surveysSurveyIdSummaryRoute from "@/contexts/survey/interface/routes/surveys.$surveyId.summary"
import * as surveysResponsesResponseIdRoute from "@/contexts/survey/interface/routes/surveys.responses.$responseId"
import * as surveysResponsesMeRoute from "@/contexts/survey/interface/routes/surveys.responses.me"
import * as thanksMessagesRoute from "@/contexts/thanks/interface/routes/thanks-messages"
import * as thanksMessagesMeRoute from "@/contexts/thanks/interface/routes/thanks-messages.me"
import * as thanksPointBalancesMeRoute from "@/contexts/thanks/interface/routes/thanks-point-balances.me"
import * as thanksPointBudgetsMeRoute from "@/contexts/thanks/interface/routes/thanks-point-budgets.me"
import * as thanksRedemptionsRoute from "@/contexts/thanks/interface/routes/thanks-redemptions"
import * as thanksRedemptionsIdApproveRoute from "@/contexts/thanks/interface/routes/thanks-redemptions.$id.approve"
import * as thanksRedemptionsIdRejectRoute from "@/contexts/thanks/interface/routes/thanks-redemptions.$id.reject"
import * as thanksRedemptionsAdminRoute from "@/contexts/thanks/interface/routes/thanks-redemptions.admin"
import * as thanksRedemptionsInboxRoute from "@/contexts/thanks/interface/routes/thanks-redemptions.inbox"
import * as thanksRedemptionsMeRoute from "@/contexts/thanks/interface/routes/thanks-redemptions.me"
import * as thanksRewardsRoute from "@/contexts/thanks/interface/routes/thanks-rewards"
import * as thanksRewardsIdRoute from "@/contexts/thanks/interface/routes/thanks-rewards.$id"
import * as trainingCoursesRoute from "@/contexts/training/interface/routes/training-courses"
import * as trainingCoursesCodeRoute from "@/contexts/training/interface/routes/training-courses.$code"
import * as trainingEnrollmentsRoute from "@/contexts/training/interface/routes/training-enrollments"
import * as trainingEnrollmentsIdRoute from "@/contexts/training/interface/routes/training-enrollments.$id"
import * as trainingEnrollmentsIdCompleteRoute from "@/contexts/training/interface/routes/training-enrollments.$id.complete"
import * as trainingEnrollmentsMeRoute from "@/contexts/training/interface/routes/training-enrollments.me"
import * as workAccidentsRoute from "@/contexts/work-accident/interface/routes/work-accidents"
import * as workAccidentsIdCloseRoute from "@/contexts/work-accident/interface/routes/work-accidents.$id.close"
import * as employeeWorkStylesRoute from "@/contexts/work-style/interface/routes/employee-work-styles"
import * as authPasswordResetRoute from "@system/interface/routes/auth.password.reset"
import * as healthRoute from "@system/interface/routes/health"
import * as oauthAuthorizationsRoute from "@system/interface/routes/oauth.authorizations"
import * as oauthMcpGrantsRoute from "@system/interface/routes/oauth.mcp-grants"
import * as oauthTokenRoute from "@system/interface/routes/oauth.token"
import * as oauthUserinfoRoute from "@system/interface/routes/oauth.userinfo"
import * as systemV1AccountsRoute from "@system/interface/routes/system.v1.accounts"
import * as systemV1AccountsAccountIdRoute from "@system/interface/routes/system.v1.accounts.$accountId"
import * as systemV1AccountsAccountIdIdentitiesRoute from "@system/interface/routes/system.v1.accounts.$accountId.identities"
import * as systemV1AccountsAccountIdIdentitiesIdentityIdRoute from "@system/interface/routes/system.v1.accounts.$accountId.identities.$identityId"
import * as systemV1AccountsAccountIdPasswordCredentialsRoute from "@system/interface/routes/system.v1.accounts.$accountId.password-credentials"
import * as systemV1AccountsAccountIdRoleBindingsRoute from "@system/interface/routes/system.v1.accounts.$accountId.role-bindings"
import * as systemV1AccountsAccountIdRoleBindingsBindingIdRoute from "@system/interface/routes/system.v1.accounts.$accountId.role-bindings.$bindingId"
import * as systemV1AuditEventsRoute from "@system/interface/routes/system.v1.audit-events"
import * as systemV1AuditEventsEventIdRoute from "@system/interface/routes/system.v1.audit-events.$eventId"
import * as systemV1BootstrapRoute from "@system/interface/routes/system.v1.bootstrap"
import * as systemV1HealthRoute from "@system/interface/routes/system.v1.health"
import * as systemV1NotificationsRoute from "@system/interface/routes/system.v1.notifications"
import * as systemV1NotificationsIdRoute from "@system/interface/routes/system.v1.notifications.$id"
import * as systemV1NotificationsUnreadCountRoute from "@system/interface/routes/system.v1.notifications.unread-count"
import * as systemV1RolesRoute from "@system/interface/routes/system.v1.roles"
import * as systemV1RolesRoleIdRoute from "@system/interface/routes/system.v1.roles.$roleId"
import * as systemV1SessionsRoute from "@system/interface/routes/system.v1.sessions"

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

const routePart2 = createRouteApp().post("/application-requests", ...applicationRequestsRoute.POST)

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
  ...applicationTemplatesRoute.POST,
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
  .post("/assets", ...assetsRoute.POST)
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
  .get("/audit-events/:eventId", ...auditEventsEventIdRoute.GET)
  .post("/auth/browser/code", ...authBrowserCodeRoute.POST)
  .post("/auth/browser/token", ...authBrowserTokenRoute.POST)
  .get("/auth/cli/callback", ...authCliCallbackRoute.GET)
  .get("/auth/cli/login", ...authCliLoginRoute.GET)
  .post("/auth/cli/token", ...authCliTokenRoute.POST)
  .post("/auth/identity/login", ...authIdentityLoginRoute.POST)
  .post("/auth/login", ...authLoginRoute.POST)
  .post("/auth/logout", ...authLogoutRoute.POST)
  .post("/auth/password/reset", ...authPasswordResetRoute.POST)
  .patch("/auth/password/reset", ...authPasswordResetRoute.PATCH)
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

const routePart25 = createRouteApp()
  .delete("/career-applications/:id", ...careerApplicationsIdRoute.DELETE)
  .get("/career-postings", ...careerPostingsRoute.GET)
  .post("/career-postings", ...careerPostingsRoute.POST)
  .get("/career-postings/:postingId", ...careerPostingsPostingIdRoute.GET)
  .put("/career-postings/:postingId", ...careerPostingsPostingIdRoute.PUT)
  .delete("/career-postings/:postingId", ...careerPostingsPostingIdRoute.DELETE)
  .post("/career-postings/:postingId/apply", ...careerPostingsPostingIdApplyRoute.POST)
  .get("/career-sheets/me", ...careerSheetsMeRoute.GET)
  .put("/career-sheets/me", ...careerSheetsMeRoute.PUT)
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
  .get("/company/v1/account-employee-links", ...companyV1AccountEmployeeLinksRoute.GET)
  .post("/company/v1/account-employee-links", ...companyV1AccountEmployeeLinksRoute.POST)
  .get("/company/v1/capabilities", ...companyV1CapabilitiesRoute.GET)
  .get("/company/v1/definitions", ...companyV1DefinitionsRoute.GET)
  .post("/company/v1/definitions", ...companyV1DefinitionsRoute.POST)
  .get("/company/v1/employees", ...companyV1EmployeesRoute.GET)
  .post("/company/v1/employees", ...companyV1EmployeesRoute.POST)
  .get("/company/v1/employments", ...companyV1EmploymentsRoute.GET)
  .post("/company/v1/employments", ...companyV1EmploymentsRoute.POST)
  .post("/company/v1/organization-changes", ...companyV1OrganizationChangesRoute.POST)
  .get("/company/v1/organization-snapshots", ...companyV1OrganizationSnapshotsRoute.GET)
  .get("/company/v1/people", ...companyV1PeopleRoute.GET)
  .post("/company/v1/people", ...companyV1PeopleRoute.POST)
  .get("/company/v1/personnel-actions", ...companyV1PersonnelActionsRoute.GET)
  .post("/company/v1/personnel-actions", ...companyV1PersonnelActionsRoute.POST)
  .get("/company/v1/profile", ...companyV1ProfileRoute.GET)
  .post("/company/v1/profile", ...companyV1ProfileRoute.POST)
  .get("/company-calendar-days", ...companyCalendarDaysRoute.GET)
  .post("/company-calendar-days", ...companyCalendarDaysRoute.POST)
  .delete("/company-calendar-days/:id", ...companyCalendarDaysIdRoute.DELETE)
  .get("/dashboard", ...dashboardRoute.GET)
  .get("/dashboard/management", ...dashboardManagementRoute.GET)
  .get("/decision-records", ...decisionRecordsRoute.GET)
  .post("/decision-records", ...decisionRecordsRoute.POST)

const routePart26 = createRouteApp()
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
  .post("/department-definitions", ...departmentDefinitionsRoute.POST)
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
  .put("/employee-skills/me", ...employeeSkillsMeRoute.PUT)
  .get("/employee-skills/me/:skillCode", ...employeeSkillsMeSkillCodeRoute.GET)
  .delete("/employee-skills/me/:skillCode", ...employeeSkillsMeSkillCodeRoute.DELETE)
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
  .post("/evaluation-sheets", ...evaluationSheetsRoute.POST)

const routePart27 = createRouteApp()
  .get("/evaluation-sheets/me", ...evaluationSheetsMeRoute.GET)
  .get("/evaluation-sheets/:sheetId", ...evaluationSheetsSheetIdRoute.GET)
  .put("/evaluation-sheets/:sheetId/evaluators", ...evaluationSheetsSheetIdEvaluatorsRoute.PUT)
  .post("/evaluation-sheets/:sheetId/transition", ...evaluationSheetsSheetIdTransitionRoute.POST)
  .get("/evaluation-templates", ...evaluationTemplatesRoute.GET)
  .post("/evaluation-templates", ...evaluationTemplatesRoute.POST)
  .get("/evaluation-templates/:templateId", ...evaluationTemplatesTemplateIdRoute.GET)
  .put("/evaluation-templates/:templateId", ...evaluationTemplatesTemplateIdRoute.PUT)
  .patch("/evaluation-templates/:templateId", ...evaluationTemplatesTemplateIdRoute.PATCH)
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
  .post("/grade-definitions", ...gradeDefinitionsRoute.POST)
  .put("/grade-definitions/:id", ...gradeDefinitionsIdRoute.PUT)
  .delete("/grade-definitions/:id", ...gradeDefinitionsIdRoute.DELETE)
  .get("/headcount-plans", ...headcountPlansRoute.GET)
  .post("/headcount-plans", ...headcountPlansRoute.POST)
  .put("/headcount-plans/:id", ...headcountPlansIdRoute.PUT)
  .get("/health", ...healthRoute.GET)
  .get("/health-checkups", ...healthCheckupsRoute.GET)

const routePart28 = createRouteApp()
  .post("/health-checkups", ...healthCheckupsRoute.POST)
  .post("/health-checkups/:id/complete", ...healthCheckupsIdCompleteRoute.POST)
  .get("/inbox/counts", ...inboxCountsRoute.GET)
  .get("/it-incidents", ...itIncidentsRoute.GET)
  .post("/it-incidents", ...itIncidentsRoute.POST)
  .post("/it-incidents/:id/resolve", ...itIncidentsIdResolveRoute.POST)
  .get("/job-openings", ...jobOpeningsRoute.GET)
  .post("/job-openings", ...jobOpeningsRoute.POST)
  .get("/job-openings/:jobOpeningId", ...jobOpeningsJobOpeningIdRoute.GET)
  .put("/job-openings/:jobOpeningId", ...jobOpeningsJobOpeningIdRoute.PUT)
  .get("/job-openings/:jobOpeningId/candidates", ...jobOpeningsJobOpeningIdCandidatesRoute.GET)
  .post("/job-openings/:jobOpeningId/candidates", ...jobOpeningsJobOpeningIdCandidatesRoute.POST)
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

const routePart29 = createRouteApp()
  .get("/meetings/:code/minutes", ...meetingsCodeMinutesRoute.GET)
  .post("/meetings/:code/minutes", ...meetingsCodeMinutesRoute.POST)
  .post("/notifications", ...notificationsRoute.POST)
  .get("/notifications/me", ...notificationsMeRoute.GET)
  .get("/notifications/me/unread-count", ...notificationsMeUnreadCountRoute.GET)
  .post("/notifications/read-all", ...notificationsReadAllRoute.POST)
  .get("/notifications/:id", ...notificationsIdRoute.GET)
  .delete("/notifications/:id", ...notificationsIdRoute.DELETE)
  .post("/notifications/:id/read", ...notificationsIdReadRoute.POST)
  .post("/oauth/authorizations", ...oauthAuthorizationsRoute.POST)
  .post("/oauth/mcp-grants", ...oauthMcpGrantsRoute.POST)
  .post("/oauth/token", ...oauthTokenRoute.POST)
  .get("/oauth/userinfo", ...oauthUserinfoRoute.GET)
  .post("/onboarding-assignments", ...onboardingAssignmentsRoute.POST)
  .get(
    "/onboarding-assignments/employees/:employeeCode",
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
  .post("/performance-goals", ...performanceGoalsRoute.POST)
  .get("/performance-goals/me", ...performanceGoalsMeRoute.GET)
  .get("/performance-goals/tree", ...performanceGoalsTreeRoute.GET)
  .get("/performance-goals/:goalId", ...performanceGoalsGoalIdRoute.GET)
  .put("/performance-goals/:goalId", ...performanceGoalsGoalIdRoute.PUT)

const routePart30 = createRouteApp()
  .delete("/performance-goals/:goalId", ...performanceGoalsGoalIdRoute.DELETE)
  .get("/performance-goals/:goalId/evaluations", ...performanceGoalsGoalIdEvaluationsRoute.GET)
  .post("/performance-goals/:goalId/evaluations", ...performanceGoalsGoalIdEvaluationsRoute.POST)
  .get("/permission-definitions", ...permissionDefinitionsRoute.GET)

const routePart31 = createRouteApp().get(
  "/personnel-action-requests",
  ...personnelActionRequestsRoute.GET,
)

const routePart32 = createRouteApp().post(
  "/personnel-action-requests",
  ...personnelActionRequestsRoute.POST,
)

const routePart33 = createRouteApp().get(
  "/personnel-action-requests/:id",
  ...personnelActionRequestsIdRoute.GET,
)

const routePart34 = createRouteApp().delete(
  "/personnel-action-requests/:id",
  ...personnelActionRequestsIdRoute.DELETE,
)

const routePart35 = createRouteApp()
  .post("/personnel-actions", ...personnelActionsRoute.POST)
  .post("/personnel-actions/:id/correct", ...personnelActionsIdCorrectRoute.POST)
  .get("/position-definitions", ...positionDefinitionsRoute.GET)
  .post("/position-definitions", ...positionDefinitionsRoute.POST)
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
  .post("/review-cycles", ...reviewCyclesRoute.POST)
  .put("/review-cycles/:cycleId", ...reviewCyclesCycleIdRoute.PUT)
  .delete("/review-cycles/:cycleId", ...reviewCyclesCycleIdRoute.DELETE)
  .post("/review-cycles/:cycleId/close", ...reviewCyclesCycleIdCloseRoute.POST)
  .post("/review-cycles/:cycleId/disclose", ...reviewCyclesCycleIdDiscloseRoute.POST)
  .post("/review-cycles/:cycleId/forms/bulk", ...reviewCyclesCycleIdFormsBulkRoute.POST)
  .post("/review-cycles/:cycleId/open", ...reviewCyclesCycleIdOpenRoute.POST)
  .get("/review-cycles/:cycleId/policy", ...reviewCyclesCycleIdPolicyRoute.GET)
  .put("/review-cycles/:cycleId/policy", ...reviewCyclesCycleIdPolicyRoute.PUT)
  .get(
    "/review-cycles/:cycleId/results/:employeeCode",
    ...reviewCyclesCycleIdResultsEmployeeCodeRoute.GET,
  )
  .get("/review-forms", ...reviewFormsRoute.GET)
  .get("/review-forms/me", ...reviewFormsMeRoute.GET)
  .post("/review-forms/:formId/submit", ...reviewFormsFormIdSubmitRoute.POST)
  .post("/ringi-requests", ...ringiRequestsRoute.POST)
  .get("/ringi-requests/admin", ...ringiRequestsAdminRoute.GET)
  .get("/ringi-requests/inbox", ...ringiRequestsInboxRoute.GET)
  .get("/ringi-requests/me", ...ringiRequestsMeRoute.GET)

const routePart36 = createRouteApp()
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
  .post("/shift-assignments", ...shiftAssignmentsRoute.POST)
  .get("/shift-assignments/me", ...shiftAssignmentsMeRoute.GET)
  .get("/shift-assignments/:id", ...shiftAssignmentsIdRoute.GET)
  .put("/shift-assignments/:id", ...shiftAssignmentsIdRoute.PUT)
  .delete("/shift-assignments/:id", ...shiftAssignmentsIdRoute.DELETE)
  .post("/shift-assignments/:id/publish", ...shiftAssignmentsIdPublishRoute.POST)
  .get("/shift-patterns", ...shiftPatternsRoute.GET)
  .post("/shift-patterns", ...shiftPatternsRoute.POST)
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

const routePart37 = createRouteApp()
  .post("/stocktakes/:id/close", ...stocktakesIdCloseRoute.POST)
  .get("/surveys", ...surveysRoute.GET)
  .post("/surveys", ...surveysRoute.POST)
  .get("/surveys/responses/me", ...surveysResponsesMeRoute.GET)
  .get("/surveys/responses/:responseId", ...surveysResponsesResponseIdRoute.GET)
  .put("/surveys/responses/:responseId", ...surveysResponsesResponseIdRoute.PUT)
  .delete("/surveys/responses/:responseId", ...surveysResponsesResponseIdRoute.DELETE)
  .get("/surveys/:surveyId", ...surveysSurveyIdRoute.GET)
  .put("/surveys/:surveyId", ...surveysSurveyIdRoute.PUT)
  .delete("/surveys/:surveyId", ...surveysSurveyIdRoute.DELETE)
  .post("/surveys/:surveyId/responses", ...surveysSurveyIdResponsesRoute.POST)
  .get("/surveys/:surveyId/summary", ...surveysSurveyIdSummaryRoute.GET)
  .get("/system/v1/accounts", ...systemV1AccountsRoute.GET)
  .post("/system/v1/accounts", ...systemV1AccountsRoute.POST)
  .get("/system/v1/accounts/:accountId", ...systemV1AccountsAccountIdRoute.GET)
  .patch("/system/v1/accounts/:accountId", ...systemV1AccountsAccountIdRoute.PATCH)
  .get("/system/v1/accounts/:accountId/identities", ...systemV1AccountsAccountIdIdentitiesRoute.GET)
  .post(
    "/system/v1/accounts/:accountId/identities",
    ...systemV1AccountsAccountIdIdentitiesRoute.POST,
  )
  .get(
    "/system/v1/accounts/:accountId/identities/:identityId",
    ...systemV1AccountsAccountIdIdentitiesIdentityIdRoute.GET,
  )
  .delete(
    "/system/v1/accounts/:accountId/identities/:identityId",
    ...systemV1AccountsAccountIdIdentitiesIdentityIdRoute.DELETE,
  )
  .patch(
    "/system/v1/accounts/:accountId/password-credentials",
    ...systemV1AccountsAccountIdPasswordCredentialsRoute.PATCH,
  )
  .get(
    "/system/v1/accounts/:accountId/role-bindings",
    ...systemV1AccountsAccountIdRoleBindingsRoute.GET,
  )
  .post(
    "/system/v1/accounts/:accountId/role-bindings",
    ...systemV1AccountsAccountIdRoleBindingsRoute.POST,
  )
  .delete(
    "/system/v1/accounts/:accountId/role-bindings/:bindingId",
    ...systemV1AccountsAccountIdRoleBindingsBindingIdRoute.DELETE,
  )
  .get("/system/v1/audit-events", ...systemV1AuditEventsRoute.GET)
  .get("/system/v1/audit-events/:eventId", ...systemV1AuditEventsEventIdRoute.GET)
  .post("/system/v1/bootstrap", ...systemV1BootstrapRoute.POST)
  .get("/system/v1/health", ...systemV1HealthRoute.GET)
  .get("/system/v1/notifications", ...systemV1NotificationsRoute.GET)
  .post("/system/v1/notifications", ...systemV1NotificationsRoute.POST)
  .patch("/system/v1/notifications", ...systemV1NotificationsRoute.PATCH)
  .get("/system/v1/notifications/unread-count", ...systemV1NotificationsUnreadCountRoute.GET)
  .get("/system/v1/notifications/:id", ...systemV1NotificationsIdRoute.GET)
  .patch("/system/v1/notifications/:id", ...systemV1NotificationsIdRoute.PATCH)
  .delete("/system/v1/notifications/:id", ...systemV1NotificationsIdRoute.DELETE)
  .get("/system/v1/roles", ...systemV1RolesRoute.GET)
  .post("/system/v1/roles", ...systemV1RolesRoute.POST)
  .get("/system/v1/roles/:roleId", ...systemV1RolesRoleIdRoute.GET)
  .patch("/system/v1/roles/:roleId", ...systemV1RolesRoleIdRoute.PATCH)
  .delete("/system/v1/roles/:roleId", ...systemV1RolesRoleIdRoute.DELETE)
  .get("/system/v1/sessions", ...systemV1SessionsRoute.GET)
  .post("/system/v1/sessions", ...systemV1SessionsRoute.POST)
  .patch("/system/v1/sessions", ...systemV1SessionsRoute.PATCH)
  .delete("/system/v1/sessions", ...systemV1SessionsRoute.DELETE)
  .get("/thanks-messages", ...thanksMessagesRoute.GET)
  .post("/thanks-messages", ...thanksMessagesRoute.POST)
  .get("/thanks-messages/me", ...thanksMessagesMeRoute.GET)
  .get("/thanks-point-balances/me", ...thanksPointBalancesMeRoute.GET)

const routePart38 = createRouteApp()
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
  .post("/training-courses", ...trainingCoursesRoute.POST)
  .get("/training-courses/:code", ...trainingCoursesCodeRoute.GET)
  .put("/training-courses/:code", ...trainingCoursesCodeRoute.PUT)
  .delete("/training-courses/:code", ...trainingCoursesCodeRoute.DELETE)
  .get("/training-enrollments", ...trainingEnrollmentsRoute.GET)
  .post("/training-enrollments", ...trainingEnrollmentsRoute.POST)
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
  .route("/", routePart37)
  .route("/", routePart38)

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
type ApiClientPart37 = ReturnType<typeof hc<typeof routePart37>>
type ApiClientPart38 = ReturnType<typeof hc<typeof routePart38>>
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
  ApiClientPart36 &
  ApiClientPart37 &
  ApiClientPart38
