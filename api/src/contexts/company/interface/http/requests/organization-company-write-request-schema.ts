import { organizationUnitCompanyResourceSchema } from "@/contexts/company/interface/http/resources/organization-unit-company-resource-schema"
import { assignmentCompanyResourceSchema } from "@/contexts/company/interface/http/resources/assignment-company-resource-schema"
import { reportingRelationCompanyResourceSchema } from "@/contexts/company/interface/http/resources/reporting-relation-company-resource-schema"
import { organizationalAuthorityCompanyResourceSchema } from "@/contexts/company/interface/http/resources/organizational-authority-company-resource-schema"
import { z } from "zod"

export const organizationCompanyWriteRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
  resources: z
    .array(
      z.discriminatedUnion("type", [
        organizationUnitCompanyResourceSchema,
        assignmentCompanyResourceSchema,
        reportingRelationCompanyResourceSchema,
        organizationalAuthorityCompanyResourceSchema,
      ]),
    )
    .min(1)
    .max(100),
})
