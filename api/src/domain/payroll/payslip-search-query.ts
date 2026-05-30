import { z } from "zod"

export const payslipSearchQuerySchema = z.object({
  period: z.string().nullable(),
  employeeId: z.number(),
})

export type PayslipSearchQuery = z.infer<typeof payslipSearchQuerySchema>
