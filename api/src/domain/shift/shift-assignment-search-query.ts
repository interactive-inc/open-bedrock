import { z } from "zod"

export const shiftAssignmentSearchQuerySchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  employeeId: z.number().nullable(),
  employeeIds: z.array(z.number()).readonly().nullable(),
})

export type ShiftAssignmentSearchQuery = z.infer<typeof shiftAssignmentSearchQuerySchema>
