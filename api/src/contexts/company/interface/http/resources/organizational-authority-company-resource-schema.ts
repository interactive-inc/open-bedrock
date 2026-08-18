import { companyResourceBaseShape } from "@/contexts/company/interface/http/company-resource-base-shape"
import { companyJsonSchema } from "@/contexts/company/interface/http/company-json-schema"
import { companyIdentifierSchema } from "@/contexts/company/interface/http/company-identifier-schema"
import { z } from "zod"

export const organizationalAuthorityCompanyResourceSchema = z.object({
  ...companyResourceBaseShape,
  type: z.literal("organizational-authority"),
  attributes: z
    .object({
      employeeId: companyIdentifierSchema,
      employmentId: companyIdentifierSchema,
      scopeType: z.literal("organization-unit"),
      scopeId: companyIdentifierSchema,
      authority: z.string().trim().min(1).max(255),
    })
    .catchall(companyJsonSchema),
})
