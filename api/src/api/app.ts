// このファイルは `bun run gen:app` が生成する。手で編集しない。
// ルートを足すときは登録済みcontextのinterface/routesへ置き、生成器を再実行する。
// middleware・エラーハンドラは手書きの api/app-base.ts が持つ。

import { hc } from "hono/client"
import { appBase, createRouteApp } from "@/api/app-base"
import * as attendanceAttendanceRecordsOvertimeSummaryRoute from "@/api/routes/attendance.attendance-records.overtime-summary"
import * as companyAccountDirectoryRoute from "@/api/routes/company.account-directory"
import * as companyApplicationRequestsRoute from "@/api/routes/company.application-requests"
import * as companyApplicationRequestsIdRoute from "@/api/routes/company.application-requests.$id"
import * as companyApplicationRequestsIdApproveRoute from "@/api/routes/company.application-requests.$id.approve"
import * as companyApplicationRequestsIdReassignWorkflowStepRoute from "@/api/routes/company.application-requests.$id.reassign-workflow-step"
import * as companyApplicationRequestsIdRejectRoute from "@/api/routes/company.application-requests.$id.reject"
import * as companyApplicationRequestsIdResubmitRoute from "@/api/routes/company.application-requests.$id.resubmit"
import * as companyApplicationRequestsAdminRoute from "@/api/routes/company.application-requests.admin"
import * as companyApplicationRequestsInboxRoute from "@/api/routes/company.application-requests.inbox"
import * as companyApplicationRequestsMeRoute from "@/api/routes/company.application-requests.me"
import * as companyApplicationRequestsWorkflowRepairsRoute from "@/api/routes/company.application-requests.workflow-repairs"
import * as companyApplicationTemplatesRoute from "@/api/routes/company.application-templates"
import * as companyApplicationTemplatesCodeRoute from "@/api/routes/company.application-templates.$code"
import * as companyApplicationTemplatesCodeWorkflowRoute from "@/api/routes/company.application-templates.$code.workflow"
import * as companyApprovalDelegationsRoute from "@/api/routes/company.approval-delegations"
import * as companyApprovalDelegationsIdRoute from "@/api/routes/company.approval-delegations.$id"
import * as companyAuditEventExportsRoute from "@/api/routes/company.audit-event-exports"
import * as companyAuditEventsRoute from "@/api/routes/company.audit-events"
import * as companyAuditEventsEventIdRoute from "@/api/routes/company.audit-events.$eventId"
import * as companyCurrentProfileRoute from "@/api/routes/company.current-profile"
import * as companyDashboardRoute from "@/api/routes/company.dashboard"
import * as companyDashboardManagementRoute from "@/api/routes/company.dashboard.management"
import * as companyEmployeeRegistrationsRoute from "@/api/routes/company.employee-registrations"
import * as companyFeaturesRoute from "@/api/routes/company.features"
import * as companyInboxCountsRoute from "@/api/routes/company.inbox.counts"
import * as companyNotificationsRoute from "@/api/routes/company.notifications"
import * as companyPersonnelActionRequestsRoute from "@/api/routes/company.personnel-action-requests"
import * as governanceGovernanceDocumentsImpactRoute from "@/api/routes/governance.governance-documents.impact"
import * as governanceGovernanceDocumentsSyncRoute from "@/api/routes/governance.governance-documents.sync"
import * as systemPermissionDefinitionsRoute from "@/api/routes/system.permission-definitions"
import * as systemProvisioningIdentitiesRoute from "@/api/routes/system.provisioning.identities"
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
import * as companyAccountEmployeeLinksRoute from "@/contexts/company/interface/routes/company.account-employee-links"
import * as companyBootstrapRoute from "@/contexts/company/interface/routes/company.bootstrap"
import * as companyCapabilitiesRoute from "@/contexts/company/interface/routes/company.capabilities"
import * as companyDefinitionsRoute from "@/contexts/company/interface/routes/company.definitions"
import * as companyEmployeeDirectoryRoute from "@/contexts/company/interface/routes/company.employee-directory"
import * as companyEmployeeDirectoryCodeRoute from "@/contexts/company/interface/routes/company.employee-directory.$code"
import * as companyEmployeeEventsRoute from "@/contexts/company/interface/routes/company.employee-events"
import * as companyEmployeeGradesRoute from "@/contexts/company/interface/routes/company.employee-grades"
import * as companyEmployeeLifecycleCodeEventsRoute from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.events"
import * as companyEmployeeLifecycleCodeStateRoute from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.state"
import * as companyEmployeesRoute from "@/contexts/company/interface/routes/company.employees"
import * as companyEmploymentsRoute from "@/contexts/company/interface/routes/company.employments"
import * as companyGradeDefinitionsRoute from "@/contexts/company/interface/routes/company.grade-definitions"
import * as companyGradeDefinitionsIdRoute from "@/contexts/company/interface/routes/company.grade-definitions.$id"
import * as companyMyDirectReportsRoute from "@/contexts/company/interface/routes/company.my-direct-reports"
import * as companyMyOrganizationUnitsRoute from "@/contexts/company/interface/routes/company.my-organization-units"
import * as companyMyProfileRoute from "@/contexts/company/interface/routes/company.my-profile"
import * as companyOrganizationChangesRoute from "@/contexts/company/interface/routes/company.organization-changes"
import * as companyOrganizationProfileRoute from "@/contexts/company/interface/routes/company.organization-profile"
import * as companyOrganizationSnapshotsRoute from "@/contexts/company/interface/routes/company.organization-snapshots"
import * as companyOrganizationTreeRoute from "@/contexts/company/interface/routes/company.organization-tree"
import * as companyOrganizationUnitsRoute from "@/contexts/company/interface/routes/company.organization-units"
import * as companyOrganizationUnitsCodeRoute from "@/contexts/company/interface/routes/company.organization-units.$code"
import * as companyOrganizationUnitsCodeMembersRoute from "@/contexts/company/interface/routes/company.organization-units.$code.members"
import * as companyPeopleRoute from "@/contexts/company/interface/routes/company.people"
import * as companyPersonnelActionExecutionsRoute from "@/contexts/company/interface/routes/company.personnel-action-executions"
import * as companyPersonnelActionsRoute from "@/contexts/company/interface/routes/company.personnel-actions"
import * as companyPositionDefinitionsRoute from "@/contexts/company/interface/routes/company.position-definitions"
import * as companyPositionDefinitionsIdRoute from "@/contexts/company/interface/routes/company.position-definitions.$id"
import * as companyProfileRoute from "@/contexts/company/interface/routes/company.profile"
import * as companyReportingLinesEmployeeCodeRoute from "@/contexts/company/interface/routes/company.reporting-lines.$employeeCode"
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
import * as expensesIdAttachmentsAttachmentIdRoute from "@/contexts/expense/interface/routes/expenses.$id.attachments.$attachmentId"
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
import * as reviewCyclesPeriodsRoute from "@/contexts/performance-review/interface/routes/review-cycles.periods"
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
import * as systemAccountsRoute from "@system/interface/routes/system.accounts"
import * as systemAccountsAccountIdRoute from "@system/interface/routes/system.accounts.$accountId"
import * as systemAccountsAccountIdIdentitiesRoute from "@system/interface/routes/system.accounts.$accountId.identities"
import * as systemAccountsAccountIdIdentitiesIdentityIdRoute from "@system/interface/routes/system.accounts.$accountId.identities.$identityId"
import * as systemAccountsAccountIdPasswordCredentialsRoute from "@system/interface/routes/system.accounts.$accountId.password-credentials"
import * as systemAccountsAccountIdRoleBindingsRoute from "@system/interface/routes/system.accounts.$accountId.role-bindings"
import * as systemAccountsAccountIdRoleBindingsBindingIdRoute from "@system/interface/routes/system.accounts.$accountId.role-bindings.$bindingId"
import * as systemAttachmentsRoute from "@system/interface/routes/system.attachments"
import * as systemAttachmentsAttachmentIdRoute from "@system/interface/routes/system.attachments.$attachmentId"
import * as systemAttachmentsPurgeUnlinkedRoute from "@system/interface/routes/system.attachments.purge-unlinked"
import * as systemAuditEventsRoute from "@system/interface/routes/system.audit-events"
import * as systemAuditEventsEventIdRoute from "@system/interface/routes/system.audit-events.$eventId"
import * as systemAuthPasswordResetRoute from "@system/interface/routes/system.auth.password.reset"
import * as systemBatchJobsRoute from "@system/interface/routes/system.batch-jobs"
import * as systemBootstrapRoute from "@system/interface/routes/system.bootstrap"
import * as systemBrowserLoginCodesRoute from "@system/interface/routes/system.browser-login-codes"
import * as systemBrowserSessionsRoute from "@system/interface/routes/system.browser-sessions"
import * as systemCliAuthorizationCallbackRoute from "@system/interface/routes/system.cli-authorization-callback"
import * as systemCliAuthorizationsRoute from "@system/interface/routes/system.cli-authorizations"
import * as systemCliSessionsRoute from "@system/interface/routes/system.cli-sessions"
import * as systemHealthRoute from "@system/interface/routes/system.health"
import * as systemIdentitySessionsRoute from "@system/interface/routes/system.identity-sessions"
import * as systemNotificationsRoute from "@system/interface/routes/system.notifications"
import * as systemNotificationsIdRoute from "@system/interface/routes/system.notifications.$id"
import * as systemNotificationsUnreadCountRoute from "@system/interface/routes/system.notifications.unread-count"
import * as systemOauthAuthorizationsRoute from "@system/interface/routes/system.oauth.authorizations"
import * as systemOauthMcpGrantsRoute from "@system/interface/routes/system.oauth.mcp-grants"
import * as systemOauthTokenRoute from "@system/interface/routes/system.oauth.token"
import * as systemOauthUserinfoRoute from "@system/interface/routes/system.oauth.userinfo"
import * as systemRolesRoute from "@system/interface/routes/system.roles"
import * as systemRolesRoleIdRoute from "@system/interface/routes/system.roles.$roleId"
import * as systemSessionsRoute from "@system/interface/routes/system.sessions"

const routePart0 = createRouteApp()
  .get("/announcement/announcements", ...announcementsRoute.GET)
  .post("/announcement/announcements", ...announcementsRoute.POST)
  .get("/announcement/announcements/:id", ...announcementsIdRoute.GET)
  .put("/announcement/announcements/:id", ...announcementsIdRoute.PUT)
  .post("/announcement/announcements/:id/archive", ...announcementsIdArchiveRoute.POST)
  .post("/announcement/announcements/:id/publish", ...announcementsIdPublishRoute.POST)
  .post("/antisocial-check/antisocial-checks", ...antisocialChecksRoute.POST)
  .get("/antisocial-check/antisocial-checks/admin", ...antisocialChecksAdminRoute.GET)
  .get("/antisocial-check/antisocial-checks/me", ...antisocialChecksMeRoute.GET)
  .get("/antisocial-check/antisocial-checks/:id", ...antisocialChecksIdRoute.GET)
  .put("/antisocial-check/antisocial-checks/:id", ...antisocialChecksIdRoute.PUT)
  .delete("/antisocial-check/antisocial-checks/:id", ...antisocialChecksIdRoute.DELETE)
  .get("/asset/assets", ...assetsRoute.GET)
  .post("/asset/assets", ...assetsRoute.POST)
  .get("/asset/assets/holdings", ...assetsHoldingsRoute.GET)
  .get("/asset/assets/lent/me", ...assetsLentMeRoute.GET)
  .get("/asset/assets/:code", ...assetsCodeRoute.GET)
  .put("/asset/assets/:code", ...assetsCodeRoute.PUT)
  .delete("/asset/assets/:code", ...assetsCodeRoute.DELETE)
  .post("/asset/assets/:code/dispose", ...assetsCodeDisposeRoute.POST)
  .post("/asset/assets/:code/lend", ...assetsCodeLendRoute.POST)
  .post("/asset/assets/:code/return", ...assetsCodeReturnRoute.POST)
  .get("/asset/stocktakes", ...stocktakesRoute.GET)
  .post("/asset/stocktakes", ...stocktakesRoute.POST)
  .get("/asset/stocktakes/:id", ...stocktakesIdRoute.GET)
  .post("/asset/stocktakes/:id/assets/:code/check", ...stocktakesIdAssetsCodeCheckRoute.POST)
  .post("/asset/stocktakes/:id/close", ...stocktakesIdCloseRoute.POST)
  .get("/attendance/attendance-records", ...attendanceRecordsRoute.GET)
  .post("/attendance/attendance-records/clock-in", ...attendanceRecordsClockInRoute.POST)
  .post("/attendance/attendance-records/clock-out", ...attendanceRecordsClockOutRoute.POST)
  .get("/attendance/attendance-records/me", ...attendanceRecordsMeRoute.GET)
  .get("/attendance/attendance-records/me/summary", ...attendanceRecordsMeSummaryRoute.GET)
  .get(
    "/attendance/attendance-records/overtime-summary",
    ...attendanceAttendanceRecordsOvertimeSummaryRoute.GET,
  )
  .post("/business-trip/business-trips", ...businessTripsRoute.POST)
  .get("/business-trip/business-trips/admin", ...businessTripsAdminRoute.GET)
  .get("/business-trip/business-trips/me", ...businessTripsMeRoute.GET)
  .get("/business-trip/business-trips/:id", ...businessTripsIdRoute.GET)
  .put("/business-trip/business-trips/:id", ...businessTripsIdRoute.PUT)
  .delete("/business-trip/business-trips/:id", ...businessTripsIdRoute.DELETE)
  .post("/business-trip/business-trips/:id/approve", ...businessTripsIdApproveRoute.POST)
  .post("/business-trip/business-trips/:id/reject", ...businessTripsIdRejectRoute.POST)
  .get("/career/career-applications/me", ...careerApplicationsMeRoute.GET)
  .get("/career/career-applications/:id", ...careerApplicationsIdRoute.GET)
  .put("/career/career-applications/:id", ...careerApplicationsIdRoute.PUT)
  .delete("/career/career-applications/:id", ...careerApplicationsIdRoute.DELETE)
  .get("/career/career-postings", ...careerPostingsRoute.GET)
  .post("/career/career-postings", ...careerPostingsRoute.POST)
  .get("/career/career-postings/:postingId", ...careerPostingsPostingIdRoute.GET)

const routePart1 = createRouteApp()
  .put("/career/career-postings/:postingId", ...careerPostingsPostingIdRoute.PUT)
  .delete("/career/career-postings/:postingId", ...careerPostingsPostingIdRoute.DELETE)
  .post("/career/career-postings/:postingId/apply", ...careerPostingsPostingIdApplyRoute.POST)
  .get("/career/career-sheets/me", ...careerSheetsMeRoute.GET)
  .put("/career/career-sheets/me", ...careerSheetsMeRoute.PUT)
  .delete("/career/career-sheets/me", ...careerSheetsMeRoute.DELETE)
  .post("/certificate-request/certificate-requests", ...certificateRequestsRoute.POST)
  .get("/certificate-request/certificate-requests/admin", ...certificateRequestsAdminRoute.GET)
  .get("/certificate-request/certificate-requests/me", ...certificateRequestsMeRoute.GET)
  .get("/certificate-request/certificate-requests/:id", ...certificateRequestsIdRoute.GET)
  .put("/certificate-request/certificate-requests/:id", ...certificateRequestsIdRoute.PUT)
  .delete("/certificate-request/certificate-requests/:id", ...certificateRequestsIdRoute.DELETE)
  .post(
    "/certificate-request/certificate-requests/:id/issue",
    ...certificateRequestsIdIssueRoute.POST,
  )
  .post(
    "/certificate-request/certificate-requests/:id/reject",
    ...certificateRequestsIdRejectRoute.POST,
  )
  .get("/certification/certification-definitions", ...certificationDefinitionsRoute.GET)
  .post("/certification/certification-definitions", ...certificationDefinitionsRoute.POST)
  .put("/certification/certification-definitions/:id", ...certificationDefinitionsIdRoute.PUT)
  .get("/certification/employee-certifications", ...employeeCertificationsRoute.GET)
  .post("/certification/employee-certifications", ...employeeCertificationsRoute.POST)
  .delete("/certification/employee-certifications/:id", ...employeeCertificationsIdRoute.DELETE)
  .get("/commendation/commendations", ...commendationsRoute.GET)
  .post("/commendation/commendations", ...commendationsRoute.POST)
  .delete("/commendation/commendations/:id", ...commendationsIdRoute.DELETE)
  .get("/company/account-directory", ...companyAccountDirectoryRoute.GET)
  .get("/company/account-employee-links", ...companyAccountEmployeeLinksRoute.GET)
  .post("/company/account-employee-links", ...companyAccountEmployeeLinksRoute.POST)

const routePart2 = createRouteApp().get(
  "/company/application-requests",
  ...companyApplicationRequestsRoute.GET,
)

const routePart3 = createRouteApp().post(
  "/company/application-requests",
  ...companyApplicationRequestsRoute.POST,
)

const routePart4 = createRouteApp().get(
  "/company/application-requests/admin",
  ...companyApplicationRequestsAdminRoute.GET,
)

const routePart5 = createRouteApp().get(
  "/company/application-requests/inbox",
  ...companyApplicationRequestsInboxRoute.GET,
)

const routePart6 = createRouteApp().get(
  "/company/application-requests/me",
  ...companyApplicationRequestsMeRoute.GET,
)

const routePart7 = createRouteApp().get(
  "/company/application-requests/workflow-repairs",
  ...companyApplicationRequestsWorkflowRepairsRoute.GET,
)

const routePart8 = createRouteApp().get(
  "/company/application-requests/:id",
  ...companyApplicationRequestsIdRoute.GET,
)

const routePart9 = createRouteApp().put(
  "/company/application-requests/:id",
  ...companyApplicationRequestsIdRoute.PUT,
)

const routePart10 = createRouteApp().delete(
  "/company/application-requests/:id",
  ...companyApplicationRequestsIdRoute.DELETE,
)

const routePart11 = createRouteApp().post(
  "/company/application-requests/:id/approve",
  ...companyApplicationRequestsIdApproveRoute.POST,
)

const routePart12 = createRouteApp().post(
  "/company/application-requests/:id/reassign-workflow-step",
  ...companyApplicationRequestsIdReassignWorkflowStepRoute.POST,
)

const routePart13 = createRouteApp().post(
  "/company/application-requests/:id/reject",
  ...companyApplicationRequestsIdRejectRoute.POST,
)

const routePart14 = createRouteApp().post(
  "/company/application-requests/:id/resubmit",
  ...companyApplicationRequestsIdResubmitRoute.POST,
)

const routePart15 = createRouteApp().get(
  "/company/application-templates",
  ...companyApplicationTemplatesRoute.GET,
)

const routePart16 = createRouteApp().post(
  "/company/application-templates",
  ...companyApplicationTemplatesRoute.POST,
)

const routePart17 = createRouteApp().get(
  "/company/application-templates/:code",
  ...companyApplicationTemplatesCodeRoute.GET,
)

const routePart18 = createRouteApp().put(
  "/company/application-templates/:code",
  ...companyApplicationTemplatesCodeRoute.PUT,
)

const routePart19 = createRouteApp().delete(
  "/company/application-templates/:code",
  ...companyApplicationTemplatesCodeRoute.DELETE,
)

const routePart20 = createRouteApp().get(
  "/company/application-templates/:code/workflow",
  ...companyApplicationTemplatesCodeWorkflowRoute.GET,
)

const routePart21 = createRouteApp().put(
  "/company/application-templates/:code/workflow",
  ...companyApplicationTemplatesCodeWorkflowRoute.PUT,
)

const routePart22 = createRouteApp().get(
  "/company/approval-delegations",
  ...companyApprovalDelegationsRoute.GET,
)

const routePart23 = createRouteApp().post(
  "/company/approval-delegations",
  ...companyApprovalDelegationsRoute.POST,
)

const routePart24 = createRouteApp().delete(
  "/company/approval-delegations/:id",
  ...companyApprovalDelegationsIdRoute.DELETE,
)

const routePart25 = createRouteApp()
  .post("/company/audit-event-exports", ...companyAuditEventExportsRoute.POST)
  .get("/company/audit-events", ...companyAuditEventsRoute.GET)
  .get("/company/audit-events/:eventId", ...companyAuditEventsEventIdRoute.GET)
  .post("/company/bootstrap", ...companyBootstrapRoute.POST)
  .get("/company/capabilities", ...companyCapabilitiesRoute.GET)
  .get("/company/current-profile", ...companyCurrentProfileRoute.GET)
  .get("/company/dashboard", ...companyDashboardRoute.GET)
  .get("/company/dashboard/management", ...companyDashboardManagementRoute.GET)
  .get("/company/definitions", ...companyDefinitionsRoute.GET)
  .post("/company/definitions", ...companyDefinitionsRoute.POST)
  .get("/company/employee-directory", ...companyEmployeeDirectoryRoute.GET)
  .get("/company/employee-directory/:code", ...companyEmployeeDirectoryCodeRoute.GET)
  .put("/company/employee-directory/:code", ...companyEmployeeDirectoryCodeRoute.PUT)
  .get("/company/employee-events", ...companyEmployeeEventsRoute.GET)
  .post("/company/employee-events", ...companyEmployeeEventsRoute.POST)
  .get("/company/employee-grades", ...companyEmployeeGradesRoute.GET)
  .post("/company/employee-grades", ...companyEmployeeGradesRoute.POST)
  .get("/company/employee-lifecycle/:code/events", ...companyEmployeeLifecycleCodeEventsRoute.GET)
  .get("/company/employee-lifecycle/:code/state", ...companyEmployeeLifecycleCodeStateRoute.GET)
  .post("/company/employee-registrations", ...companyEmployeeRegistrationsRoute.POST)
  .get("/company/employees", ...companyEmployeesRoute.GET)
  .post("/company/employees", ...companyEmployeesRoute.POST)
  .get("/company/employments", ...companyEmploymentsRoute.GET)
  .post("/company/employments", ...companyEmploymentsRoute.POST)
  .get("/company/features", ...companyFeaturesRoute.GET)
  .get("/company/grade-definitions", ...companyGradeDefinitionsRoute.GET)
  .post("/company/grade-definitions", ...companyGradeDefinitionsRoute.POST)
  .put("/company/grade-definitions/:id", ...companyGradeDefinitionsIdRoute.PUT)
  .delete("/company/grade-definitions/:id", ...companyGradeDefinitionsIdRoute.DELETE)
  .get("/company/inbox/counts", ...companyInboxCountsRoute.GET)
  .get("/company/my-direct-reports", ...companyMyDirectReportsRoute.GET)
  .get("/company/my-organization-units", ...companyMyOrganizationUnitsRoute.GET)
  .put("/company/my-profile", ...companyMyProfileRoute.PUT)
  .post("/company/notifications", ...companyNotificationsRoute.POST)
  .post("/company/organization-changes", ...companyOrganizationChangesRoute.POST)
  .get("/company/organization-profile", ...companyOrganizationProfileRoute.GET)
  .put("/company/organization-profile", ...companyOrganizationProfileRoute.PUT)
  .get("/company/organization-snapshots", ...companyOrganizationSnapshotsRoute.GET)
  .get("/company/organization-tree", ...companyOrganizationTreeRoute.GET)
  .get("/company/organization-units", ...companyOrganizationUnitsRoute.GET)
  .post("/company/organization-units", ...companyOrganizationUnitsRoute.POST)
  .get("/company/organization-units/:code", ...companyOrganizationUnitsCodeRoute.GET)
  .put("/company/organization-units/:code", ...companyOrganizationUnitsCodeRoute.PUT)
  .delete("/company/organization-units/:code", ...companyOrganizationUnitsCodeRoute.DELETE)
  .get("/company/organization-units/:code/members", ...companyOrganizationUnitsCodeMembersRoute.GET)
  .get("/company/people", ...companyPeopleRoute.GET)
  .post("/company/people", ...companyPeopleRoute.POST)
  .post("/company/personnel-action-executions", ...companyPersonnelActionExecutionsRoute.POST)

const routePart26 = createRouteApp().get(
  "/company/personnel-action-requests",
  ...companyPersonnelActionRequestsRoute.GET,
)

const routePart27 = createRouteApp().post(
  "/company/personnel-action-requests",
  ...companyPersonnelActionRequestsRoute.POST,
)

const routePart28 = createRouteApp()
  .get("/company/personnel-actions", ...companyPersonnelActionsRoute.GET)
  .post("/company/personnel-actions", ...companyPersonnelActionsRoute.POST)
  .get("/company/position-definitions", ...companyPositionDefinitionsRoute.GET)
  .post("/company/position-definitions", ...companyPositionDefinitionsRoute.POST)
  .put("/company/position-definitions/:id", ...companyPositionDefinitionsIdRoute.PUT)
  .delete("/company/position-definitions/:id", ...companyPositionDefinitionsIdRoute.DELETE)
  .get("/company/profile", ...companyProfileRoute.GET)
  .post("/company/profile", ...companyProfileRoute.POST)
  .get("/company/reporting-lines/:employeeCode", ...companyReportingLinesEmployeeCodeRoute.GET)
  .get("/company-calendar/company-calendar-days", ...companyCalendarDaysRoute.GET)
  .post("/company-calendar/company-calendar-days", ...companyCalendarDaysRoute.POST)
  .delete("/company-calendar/company-calendar-days/:id", ...companyCalendarDaysIdRoute.DELETE)
  .get("/compensation-change/salary-revisions", ...salaryRevisionsRoute.GET)
  .post("/compensation-change/salary-revisions", ...salaryRevisionsRoute.POST)
  .get("/disciplinary-action/disciplinary-actions", ...disciplinaryActionsRoute.GET)
  .post("/disciplinary-action/disciplinary-actions", ...disciplinaryActionsRoute.POST)
  .get("/document/document-ledger-entries", ...documentLedgerEntriesRoute.GET)
  .post("/document/document-ledger-entries", ...documentLedgerEntriesRoute.POST)
  .put("/document/document-ledger-entries/:id", ...documentLedgerEntriesIdRoute.PUT)
  .get("/expense/department-budgets", ...departmentBudgetsRoute.GET)
  .post("/expense/department-budgets", ...departmentBudgetsRoute.POST)
  .get("/expense/department-budgets/summary", ...departmentBudgetsSummaryRoute.GET)
  .get("/expense/department-budgets/:id", ...departmentBudgetsIdRoute.GET)
  .patch("/expense/department-budgets/:id", ...departmentBudgetsIdRoute.PATCH)
  .delete("/expense/department-budgets/:id", ...departmentBudgetsIdRoute.DELETE)
  .post("/expense/expenses", ...expensesRoute.POST)
  .get("/expense/expenses/admin", ...expensesAdminRoute.GET)
  .get("/expense/expenses/inbox", ...expensesInboxRoute.GET)
  .get("/expense/expenses/me", ...expensesMeRoute.GET)
  .get("/expense/expenses/:id", ...expensesIdRoute.GET)
  .put("/expense/expenses/:id", ...expensesIdRoute.PUT)
  .delete("/expense/expenses/:id", ...expensesIdRoute.DELETE)
  .post("/expense/expenses/:id/approve", ...expensesIdApproveRoute.POST)
  .get(
    "/expense/expenses/:id/attachments/:attachmentId",
    ...expensesIdAttachmentsAttachmentIdRoute.GET,
  )
  .post("/expense/expenses/:id/reject", ...expensesIdRejectRoute.POST)
  .post("/family-care-leave/family-care-leaves", ...familyCareLeavesRoute.POST)
  .get("/family-care-leave/family-care-leaves/admin", ...familyCareLeavesAdminRoute.GET)
  .get("/family-care-leave/family-care-leaves/me", ...familyCareLeavesMeRoute.GET)
  .get("/family-care-leave/family-care-leaves/:id", ...familyCareLeavesIdRoute.GET)
  .put("/family-care-leave/family-care-leaves/:id", ...familyCareLeavesIdRoute.PUT)
  .delete("/family-care-leave/family-care-leaves/:id", ...familyCareLeavesIdRoute.DELETE)
  .post("/family-care-leave/family-care-leaves/:id/approve", ...familyCareLeavesIdApproveRoute.POST)
  .post("/family-care-leave/family-care-leaves/:id/cancel", ...familyCareLeavesIdCancelRoute.POST)
  .get("/governance/governance-capabilities", ...governanceCapabilitiesRoute.GET)
  .get("/governance/governance-documents", ...governanceDocumentsRoute.GET)
  .get("/governance/governance-documents/impact", ...governanceGovernanceDocumentsImpactRoute.GET)
  .post("/governance/governance-documents/sync", ...governanceGovernanceDocumentsSyncRoute.POST)
  .get("/governance/governance-documents/:code", ...governanceDocumentsCodeRoute.GET)

const routePart29 = createRouteApp()
  .post(
    "/governance/governance-documents/:code/acknowledge",
    ...governanceDocumentsCodeAcknowledgeRoute.POST,
  )
  .post(
    "/governance/governance-documents/:code/versions/:version/publish",
    ...governanceDocumentsCodeVersionsVersionPublishRoute.POST,
  )
  .post(
    "/governance/governance-documents/:code/versions/:version/review",
    ...governanceDocumentsCodeVersionsVersionReviewRoute.POST,
  )
  .post(
    "/governance/governance-documents/:code/versions/:version/submit-review",
    ...governanceDocumentsCodeVersionsVersionSubmitReviewRoute.POST,
  )
  .get("/governance/governance-org-roles", ...governanceOrgRolesRoute.GET)
  .delete(
    "/governance/governance-org-roles/assignments/:id",
    ...governanceOrgRolesAssignmentsIdRoute.DELETE,
  )
  .post(
    "/governance/governance-org-roles/:code/assignments",
    ...governanceOrgRolesCodeAssignmentsRoute.POST,
  )
  .get("/headcount-plan/headcount-plans", ...headcountPlansRoute.GET)
  .post("/headcount-plan/headcount-plans", ...headcountPlansRoute.POST)
  .put("/headcount-plan/headcount-plans/:id", ...headcountPlansIdRoute.PUT)
  .get("/health-checkup/health-checkups", ...healthCheckupsRoute.GET)
  .post("/health-checkup/health-checkups", ...healthCheckupsRoute.POST)
  .post("/health-checkup/health-checkups/:id/complete", ...healthCheckupsIdCompleteRoute.POST)
  .get("/it-incident/it-incidents", ...itIncidentsRoute.GET)
  .post("/it-incident/it-incidents", ...itIncidentsRoute.POST)
  .post("/it-incident/it-incidents/:id/resolve", ...itIncidentsIdResolveRoute.POST)
  .get("/knowledge/knowledge-articles", ...knowledgeArticlesRoute.GET)
  .post("/knowledge/knowledge-articles", ...knowledgeArticlesRoute.POST)
  .get("/knowledge/knowledge-articles/:id", ...knowledgeArticlesIdRoute.GET)
  .put("/knowledge/knowledge-articles/:id", ...knowledgeArticlesIdRoute.PUT)
  .delete("/knowledge/knowledge-articles/:id", ...knowledgeArticlesIdRoute.DELETE)
  .get("/leave/leave-balances", ...leaveBalancesRoute.GET)
  .get("/leave/leave-balances/me", ...leaveBalancesMeRoute.GET)
  .get("/leave/leave-requests", ...leaveRequestsRoute.GET)
  .post("/leave/leave-requests", ...leaveRequestsRoute.POST)
  .get("/leave/leave-requests/admin", ...leaveRequestsAdminRoute.GET)
  .get("/leave/leave-requests/inbox", ...leaveRequestsInboxRoute.GET)
  .get("/leave/leave-requests/me", ...leaveRequestsMeRoute.GET)
  .get("/leave/leave-requests/:id", ...leaveRequestsIdRoute.GET)
  .put("/leave/leave-requests/:id", ...leaveRequestsIdRoute.PUT)
  .delete("/leave/leave-requests/:id", ...leaveRequestsIdRoute.DELETE)
  .post("/leave/leave-requests/:id/approve", ...leaveRequestsIdApproveRoute.POST)
  .post("/leave/leave-requests/:id/reject", ...leaveRequestsIdRejectRoute.POST)
  .post("/life-event/life-events", ...lifeEventsRoute.POST)
  .get("/life-event/life-events/admin", ...lifeEventsAdminRoute.GET)
  .get("/life-event/life-events/me", ...lifeEventsMeRoute.GET)
  .get("/life-event/life-events/:id", ...lifeEventsIdRoute.GET)
  .put("/life-event/life-events/:id", ...lifeEventsIdRoute.PUT)
  .delete("/life-event/life-events/:id", ...lifeEventsIdRoute.DELETE)
  .post("/life-event/life-events/:id/approve", ...lifeEventsIdApproveRoute.POST)
  .post("/life-event/life-events/:id/reject", ...lifeEventsIdRejectRoute.POST)
  .get("/meeting/decision-records", ...decisionRecordsRoute.GET)
  .post("/meeting/decision-records", ...decisionRecordsRoute.POST)
  .get("/meeting/decision-records/:id", ...decisionRecordsIdRoute.GET)
  .put("/meeting/decision-records/:id", ...decisionRecordsIdRoute.PUT)
  .post("/meeting/decision-records/:id/supersede", ...decisionRecordsIdSupersedeRoute.POST)
  .get("/meeting/meeting-minutes-records/:id", ...meetingMinutesRecordsIdRoute.GET)
  .put("/meeting/meeting-minutes-records/:id", ...meetingMinutesRecordsIdRoute.PUT)

const routePart30 = createRouteApp()
  .get("/meeting/meetings", ...meetingsRoute.GET)
  .post("/meeting/meetings", ...meetingsRoute.POST)
  .get("/meeting/meetings/:code", ...meetingsCodeRoute.GET)
  .put("/meeting/meetings/:code", ...meetingsCodeRoute.PUT)
  .post("/meeting/meetings/:code/archive", ...meetingsCodeArchiveRoute.POST)
  .get("/meeting/meetings/:code/minutes", ...meetingsCodeMinutesRoute.GET)
  .post("/meeting/meetings/:code/minutes", ...meetingsCodeMinutesRoute.POST)
  .post("/onboarding/onboarding-assignments", ...onboardingAssignmentsRoute.POST)
  .get(
    "/onboarding/onboarding-assignments/employees/:employeeCode",
    ...onboardingAssignmentsEmployeesEmployeeCodeRoute.GET,
  )
  .get("/onboarding/onboarding-assignments/me", ...onboardingAssignmentsMeRoute.GET)
  .get("/onboarding/onboarding-assignments/:id", ...onboardingAssignmentsIdRoute.GET)
  .put("/onboarding/onboarding-assignments/:id", ...onboardingAssignmentsIdRoute.PUT)
  .delete("/onboarding/onboarding-assignments/:id", ...onboardingAssignmentsIdRoute.DELETE)
  .post("/onboarding/onboarding-tasks/:id/complete", ...onboardingTasksIdCompleteRoute.POST)
  .post("/onboarding/onboarding-tasks/:id/uncomplete", ...onboardingTasksIdUncompleteRoute.POST)
  .get("/onboarding/onboarding-templates", ...onboardingTemplatesRoute.GET)
  .post("/onboarding/onboarding-templates", ...onboardingTemplatesRoute.POST)
  .get("/onboarding/onboarding-templates/:code", ...onboardingTemplatesCodeRoute.GET)
  .put("/onboarding/onboarding-templates/:code", ...onboardingTemplatesCodeRoute.PUT)
  .delete("/onboarding/onboarding-templates/:code", ...onboardingTemplatesCodeRoute.DELETE)
  .put(
    "/onboarding/onboarding-templates/:code/lifecycle-binding",
    ...onboardingTemplatesCodeLifecycleBindingRoute.PUT,
  )
  .delete(
    "/onboarding/onboarding-templates/:code/lifecycle-binding",
    ...onboardingTemplatesCodeLifecycleBindingRoute.DELETE,
  )
  .get("/one-on-one/one-on-ones", ...oneOnOnesRoute.GET)
  .post("/one-on-one/one-on-ones", ...oneOnOnesRoute.POST)
  .get("/one-on-one/one-on-ones/me", ...oneOnOnesMeRoute.GET)
  .get("/one-on-one/one-on-ones/:id", ...oneOnOnesIdRoute.GET)
  .put("/one-on-one/one-on-ones/:id", ...oneOnOnesIdRoute.PUT)
  .delete("/one-on-one/one-on-ones/:id", ...oneOnOnesIdRoute.DELETE)
  .get("/partner/partner-contracts", ...partnerContractsRoute.GET)
  .post("/partner/partner-contracts", ...partnerContractsRoute.POST)
  .put("/partner/partner-contracts/:id", ...partnerContractsIdRoute.PUT)
  .get("/partner/partners", ...partnersRoute.GET)
  .post("/partner/partners", ...partnersRoute.POST)
  .get("/partner/partners/:code", ...partnersCodeRoute.GET)
  .put("/partner/partners/:id", ...partnersIdRoute.PUT)
  .post("/partner/partners/:id/archive", ...partnersIdArchiveRoute.POST)
  .get("/performance-review/evaluation-sheets", ...evaluationSheetsRoute.GET)
  .post("/performance-review/evaluation-sheets", ...evaluationSheetsRoute.POST)
  .get("/performance-review/evaluation-sheets/me", ...evaluationSheetsMeRoute.GET)
  .get("/performance-review/evaluation-sheets/:sheetId", ...evaluationSheetsSheetIdRoute.GET)
  .put(
    "/performance-review/evaluation-sheets/:sheetId/evaluators",
    ...evaluationSheetsSheetIdEvaluatorsRoute.PUT,
  )
  .post(
    "/performance-review/evaluation-sheets/:sheetId/transition",
    ...evaluationSheetsSheetIdTransitionRoute.POST,
  )
  .get("/performance-review/evaluation-templates", ...evaluationTemplatesRoute.GET)
  .post("/performance-review/evaluation-templates", ...evaluationTemplatesRoute.POST)
  .get(
    "/performance-review/evaluation-templates/:templateId",
    ...evaluationTemplatesTemplateIdRoute.GET,
  )
  .put(
    "/performance-review/evaluation-templates/:templateId",
    ...evaluationTemplatesTemplateIdRoute.PUT,
  )
  .patch(
    "/performance-review/evaluation-templates/:templateId",
    ...evaluationTemplatesTemplateIdRoute.PATCH,
  )
  .get("/performance-review/performance-goals", ...performanceGoalsRoute.GET)

const routePart31 = createRouteApp()
  .post("/performance-review/performance-goals", ...performanceGoalsRoute.POST)
  .get("/performance-review/performance-goals/me", ...performanceGoalsMeRoute.GET)
  .get("/performance-review/performance-goals/tree", ...performanceGoalsTreeRoute.GET)
  .get("/performance-review/performance-goals/:goalId", ...performanceGoalsGoalIdRoute.GET)
  .put("/performance-review/performance-goals/:goalId", ...performanceGoalsGoalIdRoute.PUT)
  .delete("/performance-review/performance-goals/:goalId", ...performanceGoalsGoalIdRoute.DELETE)
  .get(
    "/performance-review/performance-goals/:goalId/evaluations",
    ...performanceGoalsGoalIdEvaluationsRoute.GET,
  )
  .post(
    "/performance-review/performance-goals/:goalId/evaluations",
    ...performanceGoalsGoalIdEvaluationsRoute.POST,
  )
  .get("/performance-review/review-cycles", ...reviewCyclesRoute.GET)
  .post("/performance-review/review-cycles", ...reviewCyclesRoute.POST)
  .get("/performance-review/review-cycles/periods", ...reviewCyclesPeriodsRoute.GET)
  .put("/performance-review/review-cycles/:cycleId", ...reviewCyclesCycleIdRoute.PUT)
  .delete("/performance-review/review-cycles/:cycleId", ...reviewCyclesCycleIdRoute.DELETE)
  .post("/performance-review/review-cycles/:cycleId/close", ...reviewCyclesCycleIdCloseRoute.POST)
  .post(
    "/performance-review/review-cycles/:cycleId/disclose",
    ...reviewCyclesCycleIdDiscloseRoute.POST,
  )
  .post(
    "/performance-review/review-cycles/:cycleId/forms/bulk",
    ...reviewCyclesCycleIdFormsBulkRoute.POST,
  )
  .post("/performance-review/review-cycles/:cycleId/open", ...reviewCyclesCycleIdOpenRoute.POST)
  .get("/performance-review/review-cycles/:cycleId/policy", ...reviewCyclesCycleIdPolicyRoute.GET)
  .put("/performance-review/review-cycles/:cycleId/policy", ...reviewCyclesCycleIdPolicyRoute.PUT)
  .get(
    "/performance-review/review-cycles/:cycleId/results/:employeeCode",
    ...reviewCyclesCycleIdResultsEmployeeCodeRoute.GET,
  )
  .get("/performance-review/review-forms", ...reviewFormsRoute.GET)
  .get("/performance-review/review-forms/me", ...reviewFormsMeRoute.GET)
  .post("/performance-review/review-forms/:formId/submit", ...reviewFormsFormIdSubmitRoute.POST)
  .get("/recruitment/job-openings", ...jobOpeningsRoute.GET)
  .post("/recruitment/job-openings", ...jobOpeningsRoute.POST)
  .get("/recruitment/job-openings/:jobOpeningId", ...jobOpeningsJobOpeningIdRoute.GET)
  .put("/recruitment/job-openings/:jobOpeningId", ...jobOpeningsJobOpeningIdRoute.PUT)
  .get(
    "/recruitment/job-openings/:jobOpeningId/candidates",
    ...jobOpeningsJobOpeningIdCandidatesRoute.GET,
  )
  .post(
    "/recruitment/job-openings/:jobOpeningId/candidates",
    ...jobOpeningsJobOpeningIdCandidatesRoute.POST,
  )
  .put("/recruitment/recruitment-candidates/:id", ...recruitmentCandidatesIdRoute.PUT)
  .post(
    "/recruitment/recruitment-candidates/:id/advance",
    ...recruitmentCandidatesIdAdvanceRoute.POST,
  )
  .get("/regulation/regulations", ...regulationsRoute.GET)
  .post("/regulation/regulations", ...regulationsRoute.POST)
  .get("/regulation/regulations/:code", ...regulationsCodeRoute.GET)
  .post("/regulation/regulations/:code/archive", ...regulationsCodeArchiveRoute.POST)
  .post("/regulation/regulations/:code/versions", ...regulationsCodeVersionsRoute.POST)
  .post("/rental/rental-reservations", ...rentalReservationsRoute.POST)
  .get("/rental/rental-reservations/admin", ...rentalReservationsAdminRoute.GET)
  .get("/rental/rental-reservations/me", ...rentalReservationsMeRoute.GET)
  .get("/rental/rental-reservations/:id", ...rentalReservationsIdRoute.GET)
  .put("/rental/rental-reservations/:id", ...rentalReservationsIdRoute.PUT)
  .delete("/rental/rental-reservations/:id", ...rentalReservationsIdRoute.DELETE)
  .post("/rental/rental-reservations/:id/lend", ...rentalReservationsIdLendRoute.POST)
  .post("/rental/rental-reservations/:id/return", ...rentalReservationsIdReturnRoute.POST)
  .post("/resignation/resignations", ...resignationsRoute.POST)
  .get("/resignation/resignations/admin", ...resignationsAdminRoute.GET)
  .get("/resignation/resignations/me", ...resignationsMeRoute.GET)
  .get("/resignation/resignations/:id", ...resignationsIdRoute.GET)

const routePart32 = createRouteApp()
  .put("/resignation/resignations/:id", ...resignationsIdRoute.PUT)
  .delete("/resignation/resignations/:id", ...resignationsIdRoute.DELETE)
  .post("/resignation/resignations/:id/accept", ...resignationsIdAcceptRoute.POST)
  .post("/resignation/resignations/:id/reject", ...resignationsIdRejectRoute.POST)
  .post("/ringi/ringi-requests", ...ringiRequestsRoute.POST)
  .get("/ringi/ringi-requests/admin", ...ringiRequestsAdminRoute.GET)
  .get("/ringi/ringi-requests/inbox", ...ringiRequestsInboxRoute.GET)
  .get("/ringi/ringi-requests/me", ...ringiRequestsMeRoute.GET)
  .post("/ringi/ringi-requests/:id/approve", ...ringiRequestsIdApproveRoute.POST)
  .post("/ringi/ringi-requests/:id/reject", ...ringiRequestsIdRejectRoute.POST)
  .get("/room/rooms", ...roomsRoute.GET)
  .post("/room/rooms", ...roomsRoute.POST)
  .get("/room/rooms/availability", ...roomsAvailabilityRoute.GET)
  .post("/room/rooms/reservations", ...roomsReservationsRoute.POST)
  .get("/room/rooms/reservations/me", ...roomsReservationsMeRoute.GET)
  .get("/room/rooms/reservations/:id", ...roomsReservationsIdRoute.GET)
  .put("/room/rooms/reservations/:id", ...roomsReservationsIdRoute.PUT)
  .delete("/room/rooms/reservations/:id", ...roomsReservationsIdRoute.DELETE)
  .get("/room/rooms/:id", ...roomsIdRoute.GET)
  .put("/room/rooms/:id", ...roomsIdRoute.PUT)
  .delete("/room/rooms/:id", ...roomsIdRoute.DELETE)
  .get("/shift/shift-assignments", ...shiftAssignmentsRoute.GET)
  .post("/shift/shift-assignments", ...shiftAssignmentsRoute.POST)
  .get("/shift/shift-assignments/me", ...shiftAssignmentsMeRoute.GET)
  .get("/shift/shift-assignments/:id", ...shiftAssignmentsIdRoute.GET)
  .put("/shift/shift-assignments/:id", ...shiftAssignmentsIdRoute.PUT)
  .delete("/shift/shift-assignments/:id", ...shiftAssignmentsIdRoute.DELETE)
  .post("/shift/shift-assignments/:id/publish", ...shiftAssignmentsIdPublishRoute.POST)
  .get("/shift/shift-patterns", ...shiftPatternsRoute.GET)
  .post("/shift/shift-patterns", ...shiftPatternsRoute.POST)
  .get("/shift/shift-patterns/:id", ...shiftPatternsIdRoute.GET)
  .put("/shift/shift-patterns/:id", ...shiftPatternsIdRoute.PUT)
  .delete("/shift/shift-patterns/:id", ...shiftPatternsIdRoute.DELETE)
  .get("/shift/shift-swap-requests", ...shiftSwapRequestsRoute.GET)
  .post("/shift/shift-swap-requests", ...shiftSwapRequestsRoute.POST)
  .get("/shift/shift-swap-requests/admin", ...shiftSwapRequestsAdminRoute.GET)
  .get("/shift/shift-swap-requests/me", ...shiftSwapRequestsMeRoute.GET)
  .get("/shift/shift-swap-requests/:id", ...shiftSwapRequestsIdRoute.GET)
  .delete("/shift/shift-swap-requests/:id", ...shiftSwapRequestsIdRoute.DELETE)
  .post("/shift/shift-swap-requests/:id/approve", ...shiftSwapRequestsIdApproveRoute.POST)
  .get("/skill/employee-skills/me", ...employeeSkillsMeRoute.GET)
  .put("/skill/employee-skills/me", ...employeeSkillsMeRoute.PUT)
  .get("/skill/employee-skills/me/:skillCode", ...employeeSkillsMeSkillCodeRoute.GET)
  .delete("/skill/employee-skills/me/:skillCode", ...employeeSkillsMeSkillCodeRoute.DELETE)
  .get("/skill/skill-definitions", ...skillDefinitionsRoute.GET)
  .get("/software-license/software-licenses", ...softwareLicensesRoute.GET)
  .post("/software-license/software-licenses", ...softwareLicensesRoute.POST)
  .put("/software-license/software-licenses/:id", ...softwareLicensesIdRoute.PUT)

const routePart33 = createRouteApp()
  .post("/software-license/software-licenses/:id/cancel", ...softwareLicensesIdCancelRoute.POST)
  .get("/survey/surveys", ...surveysRoute.GET)
  .post("/survey/surveys", ...surveysRoute.POST)
  .get("/survey/surveys/responses/me", ...surveysResponsesMeRoute.GET)
  .get("/survey/surveys/responses/:responseId", ...surveysResponsesResponseIdRoute.GET)
  .put("/survey/surveys/responses/:responseId", ...surveysResponsesResponseIdRoute.PUT)
  .delete("/survey/surveys/responses/:responseId", ...surveysResponsesResponseIdRoute.DELETE)
  .get("/survey/surveys/:surveyId", ...surveysSurveyIdRoute.GET)
  .put("/survey/surveys/:surveyId", ...surveysSurveyIdRoute.PUT)
  .delete("/survey/surveys/:surveyId", ...surveysSurveyIdRoute.DELETE)
  .post("/survey/surveys/:surveyId/responses", ...surveysSurveyIdResponsesRoute.POST)
  .get("/survey/surveys/:surveyId/summary", ...surveysSurveyIdSummaryRoute.GET)
  .get("/system/accounts", ...systemAccountsRoute.GET)
  .post("/system/accounts", ...systemAccountsRoute.POST)
  .get("/system/accounts/:accountId", ...systemAccountsAccountIdRoute.GET)
  .patch("/system/accounts/:accountId", ...systemAccountsAccountIdRoute.PATCH)
  .get("/system/accounts/:accountId/identities", ...systemAccountsAccountIdIdentitiesRoute.GET)
  .post("/system/accounts/:accountId/identities", ...systemAccountsAccountIdIdentitiesRoute.POST)
  .get(
    "/system/accounts/:accountId/identities/:identityId",
    ...systemAccountsAccountIdIdentitiesIdentityIdRoute.GET,
  )
  .delete(
    "/system/accounts/:accountId/identities/:identityId",
    ...systemAccountsAccountIdIdentitiesIdentityIdRoute.DELETE,
  )
  .patch(
    "/system/accounts/:accountId/password-credentials",
    ...systemAccountsAccountIdPasswordCredentialsRoute.PATCH,
  )
  .get("/system/accounts/:accountId/role-bindings", ...systemAccountsAccountIdRoleBindingsRoute.GET)
  .post(
    "/system/accounts/:accountId/role-bindings",
    ...systemAccountsAccountIdRoleBindingsRoute.POST,
  )
  .delete(
    "/system/accounts/:accountId/role-bindings/:bindingId",
    ...systemAccountsAccountIdRoleBindingsBindingIdRoute.DELETE,
  )
  .post("/system/attachments", ...systemAttachmentsRoute.POST)
  .post("/system/attachments/purge-unlinked", ...systemAttachmentsPurgeUnlinkedRoute.POST)
  .get("/system/attachments/:attachmentId", ...systemAttachmentsAttachmentIdRoute.GET)
  .get("/system/audit-events", ...systemAuditEventsRoute.GET)
  .get("/system/audit-events/:eventId", ...systemAuditEventsEventIdRoute.GET)
  .post("/system/auth/password/reset", ...systemAuthPasswordResetRoute.POST)
  .patch("/system/auth/password/reset", ...systemAuthPasswordResetRoute.PATCH)
  .get("/system/batch-jobs", ...systemBatchJobsRoute.GET)
  .post("/system/bootstrap", ...systemBootstrapRoute.POST)
  .post("/system/browser-login-codes", ...systemBrowserLoginCodesRoute.POST)
  .post("/system/browser-sessions", ...systemBrowserSessionsRoute.POST)
  .get("/system/cli-authorization-callback", ...systemCliAuthorizationCallbackRoute.GET)
  .get("/system/cli-authorizations", ...systemCliAuthorizationsRoute.GET)
  .post("/system/cli-sessions", ...systemCliSessionsRoute.POST)
  .get("/system/health", ...systemHealthRoute.GET)
  .post("/system/identity-sessions", ...systemIdentitySessionsRoute.POST)
  .get("/system/notifications", ...systemNotificationsRoute.GET)
  .post("/system/notifications", ...systemNotificationsRoute.POST)
  .patch("/system/notifications", ...systemNotificationsRoute.PATCH)
  .get("/system/notifications/unread-count", ...systemNotificationsUnreadCountRoute.GET)
  .get("/system/notifications/:id", ...systemNotificationsIdRoute.GET)
  .patch("/system/notifications/:id", ...systemNotificationsIdRoute.PATCH)
  .delete("/system/notifications/:id", ...systemNotificationsIdRoute.DELETE)
  .post("/system/oauth/authorizations", ...systemOauthAuthorizationsRoute.POST)

const routePart34 = createRouteApp()
  .post("/system/oauth/mcp-grants", ...systemOauthMcpGrantsRoute.POST)
  .post("/system/oauth/token", ...systemOauthTokenRoute.POST)
  .get("/system/oauth/userinfo", ...systemOauthUserinfoRoute.GET)
  .get("/system/permission-definitions", ...systemPermissionDefinitionsRoute.GET)
  .post("/system/provisioning/identities", ...systemProvisioningIdentitiesRoute.POST)
  .get("/system/roles", ...systemRolesRoute.GET)
  .post("/system/roles", ...systemRolesRoute.POST)
  .get("/system/roles/:roleId", ...systemRolesRoleIdRoute.GET)
  .patch("/system/roles/:roleId", ...systemRolesRoleIdRoute.PATCH)
  .delete("/system/roles/:roleId", ...systemRolesRoleIdRoute.DELETE)
  .get("/system/sessions", ...systemSessionsRoute.GET)
  .post("/system/sessions", ...systemSessionsRoute.POST)
  .patch("/system/sessions", ...systemSessionsRoute.PATCH)
  .delete("/system/sessions", ...systemSessionsRoute.DELETE)
  .get("/thanks/thanks-messages", ...thanksMessagesRoute.GET)
  .post("/thanks/thanks-messages", ...thanksMessagesRoute.POST)
  .get("/thanks/thanks-messages/me", ...thanksMessagesMeRoute.GET)
  .get("/thanks/thanks-point-balances/me", ...thanksPointBalancesMeRoute.GET)
  .get("/thanks/thanks-point-budgets/me", ...thanksPointBudgetsMeRoute.GET)
  .post("/thanks/thanks-redemptions", ...thanksRedemptionsRoute.POST)
  .get("/thanks/thanks-redemptions/admin", ...thanksRedemptionsAdminRoute.GET)
  .get("/thanks/thanks-redemptions/inbox", ...thanksRedemptionsInboxRoute.GET)
  .get("/thanks/thanks-redemptions/me", ...thanksRedemptionsMeRoute.GET)
  .post("/thanks/thanks-redemptions/:id/approve", ...thanksRedemptionsIdApproveRoute.POST)
  .post("/thanks/thanks-redemptions/:id/reject", ...thanksRedemptionsIdRejectRoute.POST)
  .get("/thanks/thanks-rewards", ...thanksRewardsRoute.GET)
  .post("/thanks/thanks-rewards", ...thanksRewardsRoute.POST)
  .patch("/thanks/thanks-rewards/:id", ...thanksRewardsIdRoute.PATCH)
  .get("/training/training-courses", ...trainingCoursesRoute.GET)
  .post("/training/training-courses", ...trainingCoursesRoute.POST)
  .get("/training/training-courses/:code", ...trainingCoursesCodeRoute.GET)
  .put("/training/training-courses/:code", ...trainingCoursesCodeRoute.PUT)
  .delete("/training/training-courses/:code", ...trainingCoursesCodeRoute.DELETE)
  .get("/training/training-enrollments", ...trainingEnrollmentsRoute.GET)
  .post("/training/training-enrollments", ...trainingEnrollmentsRoute.POST)
  .get("/training/training-enrollments/me", ...trainingEnrollmentsMeRoute.GET)
  .get("/training/training-enrollments/:id", ...trainingEnrollmentsIdRoute.GET)
  .put("/training/training-enrollments/:id", ...trainingEnrollmentsIdRoute.PUT)
  .delete("/training/training-enrollments/:id", ...trainingEnrollmentsIdRoute.DELETE)
  .post("/training/training-enrollments/:id/complete", ...trainingEnrollmentsIdCompleteRoute.POST)
  .get("/work-accident/work-accidents", ...workAccidentsRoute.GET)
  .post("/work-accident/work-accidents", ...workAccidentsRoute.POST)
  .post("/work-accident/work-accidents/:id/close", ...workAccidentsIdCloseRoute.POST)
  .get("/work-style/employee-work-styles", ...employeeWorkStylesRoute.GET)
  .post("/work-style/employee-work-styles", ...employeeWorkStylesRoute.POST)

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
  ApiClientPart34
