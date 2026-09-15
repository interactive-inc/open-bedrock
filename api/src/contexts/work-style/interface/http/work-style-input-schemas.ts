import { z } from "zod"

export const employeeWorkStyleIdSchema = z.coerce.number().int().positive().safe()
