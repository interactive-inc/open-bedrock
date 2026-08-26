import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { Hono } from "hono"
import * as accountEmployeeLinks from "@/contexts/company/interface/routes/company.account-employee-links"
import * as bootstrap from "@/contexts/company/interface/routes/company.bootstrap"
import * as capabilities from "@/contexts/company/interface/routes/company.capabilities"
import * as definitions from "@/contexts/company/interface/routes/company.definitions"
import * as employees from "@/contexts/company/interface/routes/company.employees"
import * as employments from "@/contexts/company/interface/routes/company.employments"
import * as organizationChanges from "@/contexts/company/interface/routes/company.organization-changes"
import * as organizationProfile from "@/contexts/company/interface/routes/company.organization-profile"
import * as organizationSnapshots from "@/contexts/company/interface/routes/company.organization-snapshots"
import * as people from "@/contexts/company/interface/routes/company.people"
import * as personnelActions from "@/contexts/company/interface/routes/company.personnel-actions"
import * as profile from "@/contexts/company/interface/routes/company.profile"

// `bun run gen:app` の生成物。手で編集せず、routeは所有contextのinterface/route-manifest.tsへ足す。
export const companyAuthenticatedRoutes = new Hono<CompanyHttpEnvironment>()
  .get("/account-employee-links", ...accountEmployeeLinks.GET)
  .post("/bootstrap", ...bootstrap.POST)
  .get("/capabilities", ...capabilities.GET)
  .get("/definitions", ...definitions.GET)
  .get("/employees", ...employees.GET)
  .get("/employments", ...employments.GET)
  .get("/organization-profile", ...organizationProfile.GET)
  .get("/organization-snapshots", ...organizationSnapshots.GET)
  .get("/people", ...people.GET)
  .get("/personnel-actions", ...personnelActions.GET)
  .get("/profile", ...profile.GET)

export const companyAuditedRoutes = new Hono<CompanyHttpEnvironment>()
  .post("/account-employee-links", ...accountEmployeeLinks.POST)
  .post("/definitions", ...definitions.POST)
  .post("/employees", ...employees.POST)
  .post("/employments", ...employments.POST)
  .post("/organization-changes", ...organizationChanges.POST)
  .put("/organization-profile", ...organizationProfile.PUT)
  .post("/people", ...people.POST)
  .post("/personnel-actions", ...personnelActions.POST)
  .post("/profile", ...profile.POST)
