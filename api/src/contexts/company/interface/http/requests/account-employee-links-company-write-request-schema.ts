import { accountEmployeeLinkCompanyResourceSchema } from "@/contexts/company/interface/http/resources/account-employee-link-company-resource-schema"
import { z } from "zod"

export const accountEmployeeLinksCompanyWriteRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
  resources: z.array(accountEmployeeLinkCompanyResourceSchema).min(1).max(100),
})
