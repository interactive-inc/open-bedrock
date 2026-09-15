import { z } from "zod"

export const knowledgeIdSchema = z.coerce.number().int().positive().safe()
