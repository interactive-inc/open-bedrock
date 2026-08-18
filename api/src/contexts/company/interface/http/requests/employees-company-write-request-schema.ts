import { employeeCompanyResourceSchema } from "@/contexts/company/interface/http/resources/employee-company-resource-schema"
import { z } from "zod"

export const employeesCompanyWriteRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
  resources: z.array(employeeCompanyResourceSchema).min(1).max(100),
})
