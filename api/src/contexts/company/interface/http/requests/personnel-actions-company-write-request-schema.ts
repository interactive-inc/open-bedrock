import { personnelActionCompanyResourceSchema } from "@/contexts/company/interface/http/resources/personnel-action-company-resource-schema"
import { z } from "zod"

export const personnelActionsCompanyWriteRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
  resources: z.array(personnelActionCompanyResourceSchema).min(1).max(100),
})
