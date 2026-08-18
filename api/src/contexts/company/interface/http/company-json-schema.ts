import type { CompanyJson } from "@/contexts/company/domain/core/company-resource"
import { z } from "zod"

export const companyJsonSchema: z.ZodType<CompanyJson> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(companyJsonSchema),
    z.object({}).catchall(companyJsonSchema),
  ]),
)
