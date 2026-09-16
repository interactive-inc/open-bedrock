import { z } from "zod"

export const commendationIdSchema = z.coerce.number().int().safe()
