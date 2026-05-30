import { z } from "zod"

export const departmentSchema = z.object({
  id: z.number(),
  name: z.string(),
})

export type Department = z.infer<typeof departmentSchema>
