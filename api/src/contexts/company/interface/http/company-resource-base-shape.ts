import { isCalendarDate } from "@/contexts/company/domain/workforce/is-calendar-date"
import { companyIdentifierSchema } from "@/contexts/company/interface/http/company-identifier-schema"
import { z } from "zod"

export const companyResourceBaseShape = {
  organizationId: companyIdentifierSchema,
  id: companyIdentifierSchema,
  revision: z.number().int().min(1),
  state: z.enum(["active", "void"]),
  effectiveFrom: z.string().refine((value): boolean => isCalendarDate(value)),
  effectiveTo: z
    .string()
    .refine((value): boolean => isCalendarDate(value))
    .nullable(),
} as const
