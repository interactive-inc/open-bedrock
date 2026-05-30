import { z } from "zod"

export const employeeSearchQuerySchema = z.object({
  q: z.string().nullable(),
  dept: z.string().nullable(),
  status: z.string().nullable(),
})

export type EmployeeSearchQuery = z.infer<typeof employeeSearchQuerySchema>
