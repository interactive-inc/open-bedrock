import { z } from "zod"

export const healthCheckupIdSchema = z.coerce.number().int().safe()
