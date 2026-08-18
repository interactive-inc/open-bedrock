import { legalEntityCompanyResourceSchema } from "@/contexts/company/interface/http/resources/legal-entity-company-resource-schema"
import { companyProfileCompanyResourceSchema } from "@/contexts/company/interface/http/resources/company-profile-company-resource-schema"
import { z } from "zod"

export const profileCompanyWriteRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
  resources: z
    .array(
      z.discriminatedUnion("type", [
        legalEntityCompanyResourceSchema,
        companyProfileCompanyResourceSchema,
      ]),
    )
    .min(1)
    .max(100),
})
