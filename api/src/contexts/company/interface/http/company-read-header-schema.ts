import { companyIdentifierSchema } from "@/contexts/company/interface/http/company-identifier-schema"
import { z } from "zod"

export const companyReadHeaderSchema = z.object({
  "x-company-organization-id": companyIdentifierSchema,
})
