import { z } from "zod"

export const headcountPlanIdSchema = z.coerce.number().int().safe()
