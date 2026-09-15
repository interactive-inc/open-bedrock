import { z } from "zod"

export const documentIdSchema = z.coerce.number().int().positive().safe()
