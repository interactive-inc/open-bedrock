import { companyIdentifierSchema } from "@/contexts/company/interface/http/company-identifier-schema"
import { z } from "zod"

export const companyWriteHeaderSchema = z.object({
  "x-company-organization-id": companyIdentifierSchema,
  "idempotency-key": companyIdentifierSchema,
  "if-match": z.string().regex(/^(?:W\/)?(?:"\d+"|\d+)$/),
})
