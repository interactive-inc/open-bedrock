import { companyResourceBaseShape } from "@/contexts/company/interface/http/company-resource-base-shape"
import { companyJsonSchema } from "@/contexts/company/interface/http/company-json-schema"
import { z } from "zod"

export const companyProfileCompanyResourceSchema = z.object({
  ...companyResourceBaseShape,
  type: z.literal("company-profile"),
  attributes: z
    .object({
      displayName: z.string().trim().min(1).max(2_000),
    })
    .catchall(companyJsonSchema),
})
