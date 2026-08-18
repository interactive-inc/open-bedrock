import { companyResourceBaseShape } from "@/contexts/company/interface/http/company-resource-base-shape"
import { companyJsonSchema } from "@/contexts/company/interface/http/company-json-schema"
import { z } from "zod"

export const gradeCompanyResourceSchema = z.object({
  ...companyResourceBaseShape,
  type: z.literal("grade"),
  attributes: z
    .object({
      code: z.string().trim().min(1).max(255),
      officialName: z.string().trim().min(1).max(2_000),
    })
    .catchall(companyJsonSchema),
})
