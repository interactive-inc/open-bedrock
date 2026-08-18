import { companyResourceBaseShape } from "@/contexts/company/interface/http/company-resource-base-shape"
import { companyJsonSchema } from "@/contexts/company/interface/http/company-json-schema"
import { companyIdentifierSchema } from "@/contexts/company/interface/http/company-identifier-schema"
import { z } from "zod"

export const accountEmployeeLinkCompanyResourceSchema = z.object({
  ...companyResourceBaseShape,
  type: z.literal("account-employee-link"),
  attributes: z
    .object({
      accountId: companyIdentifierSchema,
      employeeId: companyIdentifierSchema,
    })
    .catchall(companyJsonSchema),
})
