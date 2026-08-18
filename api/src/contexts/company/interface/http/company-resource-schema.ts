import { accountEmployeeLinkCompanyResourceSchema } from "@/contexts/company/interface/http/resources/account-employee-link-company-resource-schema"
import { assignmentCompanyResourceSchema } from "@/contexts/company/interface/http/resources/assignment-company-resource-schema"
import { collectiveBodyCompanyResourceSchema } from "@/contexts/company/interface/http/resources/collective-body-company-resource-schema"
import { companyProfileCompanyResourceSchema } from "@/contexts/company/interface/http/resources/company-profile-company-resource-schema"
import { employeeCompanyResourceSchema } from "@/contexts/company/interface/http/resources/employee-company-resource-schema"
import { employmentCompanyResourceSchema } from "@/contexts/company/interface/http/resources/employment-company-resource-schema"
import { gradeCompanyResourceSchema } from "@/contexts/company/interface/http/resources/grade-company-resource-schema"
import { legalEntityCompanyResourceSchema } from "@/contexts/company/interface/http/resources/legal-entity-company-resource-schema"
import { organizationUnitCompanyResourceSchema } from "@/contexts/company/interface/http/resources/organization-unit-company-resource-schema"
import { organizationalAuthorityCompanyResourceSchema } from "@/contexts/company/interface/http/resources/organizational-authority-company-resource-schema"
import { personCompanyResourceSchema } from "@/contexts/company/interface/http/resources/person-company-resource-schema"
import { personnelActionCompanyResourceSchema } from "@/contexts/company/interface/http/resources/personnel-action-company-resource-schema"
import { positionCompanyResourceSchema } from "@/contexts/company/interface/http/resources/position-company-resource-schema"
import { reportingRelationCompanyResourceSchema } from "@/contexts/company/interface/http/resources/reporting-relation-company-resource-schema"
import { responsibilityCompanyResourceSchema } from "@/contexts/company/interface/http/resources/responsibility-company-resource-schema"
import { z } from "zod"

export const companyResourceSchema = z.discriminatedUnion("type", [
  legalEntityCompanyResourceSchema,
  companyProfileCompanyResourceSchema,
  personCompanyResourceSchema,
  employeeCompanyResourceSchema,
  employmentCompanyResourceSchema,
  organizationUnitCompanyResourceSchema,
  assignmentCompanyResourceSchema,
  reportingRelationCompanyResourceSchema,
  positionCompanyResourceSchema,
  gradeCompanyResourceSchema,
  responsibilityCompanyResourceSchema,
  collectiveBodyCompanyResourceSchema,
  organizationalAuthorityCompanyResourceSchema,
  accountEmployeeLinkCompanyResourceSchema,
  personnelActionCompanyResourceSchema,
])
