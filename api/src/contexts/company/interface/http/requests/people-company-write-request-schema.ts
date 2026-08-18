import { personCompanyResourceSchema } from "@/contexts/company/interface/http/resources/person-company-resource-schema"
import { z } from "zod"

export const peopleCompanyWriteRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
  resources: z.array(personCompanyResourceSchema).min(1).max(100),
})
