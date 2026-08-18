import { companyResourceBaseShape } from "@/contexts/company/interface/http/company-resource-base-shape"
import { companyJsonSchema } from "@/contexts/company/interface/http/company-json-schema"
import { companyIdentifierSchema } from "@/contexts/company/interface/http/company-identifier-schema"
import { z } from "zod"

export const reportingRelationCompanyResourceSchema = z.object({
  ...companyResourceBaseShape,
  type: z.literal("reporting-relation"),
  attributes: z
    .object({
      employeeId: companyIdentifierSchema,
      managerEmployeeId: companyIdentifierSchema,
      organizationUnitId: companyIdentifierSchema,
    })
    .catchall(companyJsonSchema),
})
