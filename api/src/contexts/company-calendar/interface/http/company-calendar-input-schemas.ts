import { z } from "zod"

export const companyCalendarDayIdSchema = z.coerce.number().int().safe()
