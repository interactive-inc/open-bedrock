import { positionCompanyResourceSchema } from "@/contexts/company/interface/http/resources/position-company-resource-schema"
import { gradeCompanyResourceSchema } from "@/contexts/company/interface/http/resources/grade-company-resource-schema"
import { responsibilityCompanyResourceSchema } from "@/contexts/company/interface/http/resources/responsibility-company-resource-schema"
import { collectiveBodyCompanyResourceSchema } from "@/contexts/company/interface/http/resources/collective-body-company-resource-schema"
import { z } from "zod"

export const definitionsCompanyWriteRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
  resources: z
    .array(
      z.discriminatedUnion("type", [
        positionCompanyResourceSchema,
        gradeCompanyResourceSchema,
        responsibilityCompanyResourceSchema,
        collectiveBodyCompanyResourceSchema,
      ]),
    )
    .min(1)
    .max(100),
})
