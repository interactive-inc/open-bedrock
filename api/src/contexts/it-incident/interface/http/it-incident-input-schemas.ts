import { z } from "zod"

export const itIncidentIdSchema = z.coerce.number().int().safe()
