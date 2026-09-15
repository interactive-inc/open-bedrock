import { z } from "zod"

export const disciplinaryActionIdSchema = z.coerce.number().int().positive().safe()
