import { z } from "zod"

export const announcementIdSchema = z.coerce.number().int().safe()
