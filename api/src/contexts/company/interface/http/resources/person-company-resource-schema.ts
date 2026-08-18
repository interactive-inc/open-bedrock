import { companyResourceBaseShape } from "@/contexts/company/interface/http/company-resource-base-shape"
import { companyJsonSchema } from "@/contexts/company/interface/http/company-json-schema"
import { z } from "zod"

export const personCompanyResourceSchema = z.object({
  ...companyResourceBaseShape,
  type: z.literal("person"),
  attributes: z
    .object({
      officialName: z.string().trim().min(1).max(2_000),
      email: z.string().email().nullable().optional(),
      phone: z.string().trim().min(1).max(255).nullable().optional(),
    })
    .catchall(companyJsonSchema),
})
