import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { Hono } from "hono"
import * as accountEmployeeLinks from "@/contexts/company/interface/routes/company.account-employee-links"
import * as bootstrap from "@/contexts/company/interface/routes/company.bootstrap"
import * as capabilities from "@/contexts/company/interface/routes/company.capabilities"
import * as definitions from "@/contexts/company/interface/routes/company.definitions"
import * as employeeDirectory from "@/contexts/company/interface/routes/company.employee-directory"
import * as employeeDirectoryCode from "@/contexts/company/interface/routes/company.employee-directory.$code"
import * as employeeEvents from "@/contexts/company/interface/routes/company.employee-events"
import * as employeeGrades from "@/contexts/company/interface/routes/company.employee-grades"
import * as employeeLifecycleCodeEvents from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.events"
import * as employeeLifecycleCodeState from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.state"
import * as employees from "@/contexts/company/interface/routes/company.employees"
import * as employments from "@/contexts/company/interface/routes/company.employments"
import * as gradeDefinitions from "@/contexts/company/interface/routes/company.grade-definitions"
import * as gradeDefinitionsId from "@/contexts/company/interface/routes/company.grade-definitions.$id"
import * as myDirectReports from "@/contexts/company/interface/routes/company.my-direct-reports"
import * as myOrganizationUnits from "@/contexts/company/interface/routes/company.my-organization-units"
import * as myProfile from "@/contexts/company/interface/routes/company.my-profile"
import * as organizationChanges from "@/contexts/company/interface/routes/company.organization-changes"
import * as organizationProfile from "@/contexts/company/interface/routes/company.organization-profile"
import * as organizationSnapshots from "@/contexts/company/interface/routes/company.organization-snapshots"
import * as organizationTree from "@/contexts/company/interface/routes/company.organization-tree"
import * as organizationUnits from "@/contexts/company/interface/routes/company.organization-units"
import * as organizationUnitsCode from "@/contexts/company/interface/routes/company.organization-units.$code"
import * as organizationUnitsCodeMembers from "@/contexts/company/interface/routes/company.organization-units.$code.members"
import * as people from "@/contexts/company/interface/routes/company.people"
import * as personnelActionExecutions from "@/contexts/company/interface/routes/company.personnel-action-executions"
import * as personnelActions from "@/contexts/company/interface/routes/company.personnel-actions"
import * as positionDefinitions from "@/contexts/company/interface/routes/company.position-definitions"
import * as positionDefinitionsId from "@/contexts/company/interface/routes/company.position-definitions.$id"
import * as profile from "@/contexts/company/interface/routes/company.profile"
import * as reportingLinesEmployeeCode from "@/contexts/company/interface/routes/company.reporting-lines.$employeeCode"

// `bun run gen:app` の生成物。手で編集せず、routeは所有contextのinterface/route-manifest.tsへ足す。
export const companyAuthenticatedRoutes = new Hono<CompanyHttpEnvironment>()
  .get("/account-employee-links", ...accountEmployeeLinks.GET)
  .post("/bootstrap", ...bootstrap.POST)
  .get("/capabilities", ...capabilities.GET)
  .get("/definitions", ...definitions.GET)
  .get("/employee-directory", ...employeeDirectory.GET)
  .get("/employee-directory/:code", ...employeeDirectoryCode.GET)
  .get("/employee-events", ...employeeEvents.GET)
  .get("/employee-grades", ...employeeGrades.GET)
  .get("/employee-lifecycle/:code/events", ...employeeLifecycleCodeEvents.GET)
  .get("/employee-lifecycle/:code/state", ...employeeLifecycleCodeState.GET)
  .get("/employees", ...employees.GET)
  .get("/employments", ...employments.GET)
  .get("/grade-definitions", ...gradeDefinitions.GET)
  .get("/my-direct-reports", ...myDirectReports.GET)
  .get("/my-organization-units", ...myOrganizationUnits.GET)
  .get("/organization-profile", ...organizationProfile.GET)
  .get("/organization-snapshots", ...organizationSnapshots.GET)
  .get("/organization-tree", ...organizationTree.GET)
  .get("/organization-units", ...organizationUnits.GET)
  .get("/organization-units/:code", ...organizationUnitsCode.GET)
  .get("/organization-units/:code/members", ...organizationUnitsCodeMembers.GET)
  .get("/people", ...people.GET)
  .get("/personnel-actions", ...personnelActions.GET)
  .get("/position-definitions", ...positionDefinitions.GET)
  .get("/profile", ...profile.GET)
  .get("/reporting-lines/:employeeCode", ...reportingLinesEmployeeCode.GET)

export const companyAuditedRoutes = new Hono<CompanyHttpEnvironment>()
  .post("/account-employee-links", ...accountEmployeeLinks.POST)
  .post("/definitions", ...definitions.POST)
  .put("/employee-directory/:code", ...employeeDirectoryCode.PUT)
  .post("/employee-events", ...employeeEvents.POST)
  .post("/employee-grades", ...employeeGrades.POST)
  .post("/employees", ...employees.POST)
  .post("/employments", ...employments.POST)
  .post("/grade-definitions", ...gradeDefinitions.POST)
  .put("/grade-definitions/:id", ...gradeDefinitionsId.PUT)
  .delete("/grade-definitions/:id", ...gradeDefinitionsId.DELETE)
  .put("/my-profile", ...myProfile.PUT)
  .post("/organization-changes", ...organizationChanges.POST)
  .put("/organization-profile", ...organizationProfile.PUT)
  .post("/organization-units", ...organizationUnits.POST)
  .put("/organization-units/:code", ...organizationUnitsCode.PUT)
  .delete("/organization-units/:code", ...organizationUnitsCode.DELETE)
  .post("/people", ...people.POST)
  .post("/personnel-action-executions", ...personnelActionExecutions.POST)
  .post("/personnel-actions", ...personnelActions.POST)
  .post("/position-definitions", ...positionDefinitions.POST)
  .put("/position-definitions/:id", ...positionDefinitionsId.PUT)
  .delete("/position-definitions/:id", ...positionDefinitionsId.DELETE)
  .post("/profile", ...profile.POST)
