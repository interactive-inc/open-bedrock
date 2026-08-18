import { employmentCompanyResourceSchema } from "@/contexts/company/interface/http/resources/employment-company-resource-schema"
import { z } from "zod"

export const employmentsCompanyWriteRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
  resources: z.array(employmentCompanyResourceSchema).min(1).max(100),
})
