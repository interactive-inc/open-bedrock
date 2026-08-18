import { companyResourceBaseShape } from "@/contexts/company/interface/http/company-resource-base-shape"
import { companyJsonSchema } from "@/contexts/company/interface/http/company-json-schema"
import { companyIdentifierSchema } from "@/contexts/company/interface/http/company-identifier-schema"
import { z } from "zod"

export const employmentCompanyResourceSchema = z.object({
  ...companyResourceBaseShape,
  type: z.literal("employment"),
  attributes: z
    .object({
      employeeId: companyIdentifierSchema,
      status: z.enum(["ACTIVE", "ON_LEAVE", "RETIRED"]),
      employmentType: z.string().trim().min(1).max(255).optional(),
      officialName: z.string().trim().min(1).max(2_000).optional(),
    })
    .catchall(companyJsonSchema),
})
