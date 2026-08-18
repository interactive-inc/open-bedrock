import { companyResourceBaseShape } from "@/contexts/company/interface/http/company-resource-base-shape"
import { companyJsonSchema } from "@/contexts/company/interface/http/company-json-schema"
import { companyIdentifierSchema } from "@/contexts/company/interface/http/company-identifier-schema"
import { z } from "zod"

export const employeeCompanyResourceSchema = z.object({
  ...companyResourceBaseShape,
  type: z.literal("employee"),
  attributes: z
    .object({
      personId: companyIdentifierSchema,
      employeeCode: z.string().trim().min(1).max(255).nullable().optional(),
    })
    .catchall(companyJsonSchema),
})
