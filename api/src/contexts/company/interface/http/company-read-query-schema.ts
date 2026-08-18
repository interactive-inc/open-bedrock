import { isCalendarDate } from "@/contexts/company/domain/workforce/is-calendar-date"
import { companyIdentifierSchema } from "@/contexts/company/interface/http/company-identifier-schema"
import { z } from "zod"

export const companyReadQuerySchema = z
  .object({
    id: z.union([companyIdentifierSchema, z.array(companyIdentifierSchema).max(100)]).optional(),
    effective_on: z.string().refine(isCalendarDate).optional(),
    as_of: z.string().refine(isCalendarDate).optional(),
  })
  .refine(
    (query) =>
      query.effective_on === undefined ||
      query.as_of === undefined ||
      query.effective_on === query.as_of,
  )
