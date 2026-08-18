import { companyResourceBaseShape } from "@/contexts/company/interface/http/company-resource-base-shape"
import { companyJsonSchema } from "@/contexts/company/interface/http/company-json-schema"
import { z } from "zod"

export const personnelActionCompanyResourceSchema = z.object({
  ...companyResourceBaseShape,
  type: z.literal("personnel-action"),
  attributes: z
    .object({
      actionType: z.string().trim().min(1).max(255),
    })
    .catchall(companyJsonSchema),
})
