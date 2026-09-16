import { z } from "zod"

export const workAccidentIdSchema = z.coerce.number().int().safe()
