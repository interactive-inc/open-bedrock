import { z } from "zod"

export const payslipSearchQueryInputSchema = z.object({
  period: z.string().optional(),
})

export type PayslipSearchQueryInput = z.infer<typeof payslipSearchQueryInputSchema>
