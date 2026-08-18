import { companyResourceBaseShape } from "@/contexts/company/interface/http/company-resource-base-shape"
import { companyJsonSchema } from "@/contexts/company/interface/http/company-json-schema"
import { companyIdentifierSchema } from "@/contexts/company/interface/http/company-identifier-schema"
import { organizationUnitKinds } from "@/contexts/company/domain/workforce/organization-unit"
import { z } from "zod"

export const organizationUnitCompanyResourceSchema = z.object({
  ...companyResourceBaseShape,
  type: z.literal("organization-unit"),
  attributes: z
    .object({
      organizationUnitId: companyIdentifierSchema,
      code: z.string().trim().min(1).max(64),
      officialName: z.string().trim().min(1).max(200),
      kind: z.enum(organizationUnitKinds),
      parentOrganizationUnitId: companyIdentifierSchema.nullable(),
    })
    .catchall(companyJsonSchema),
})
