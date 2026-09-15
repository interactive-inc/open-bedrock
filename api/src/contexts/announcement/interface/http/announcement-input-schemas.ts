import { z } from "zod"

export const announcementIdSchema = z.coerce.number().int().positive().safe()
