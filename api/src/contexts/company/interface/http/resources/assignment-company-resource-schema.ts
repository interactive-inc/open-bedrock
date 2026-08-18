import { companyResourceBaseShape } from "@/contexts/company/interface/http/company-resource-base-shape"
import { companyJsonSchema } from "@/contexts/company/interface/http/company-json-schema"
import { companyIdentifierSchema } from "@/contexts/company/interface/http/company-identifier-schema"
import { orgAssignmentTypes } from "@/contexts/company/domain/workforce/org-assignment-type"
import { z } from "zod"

export const assignmentCompanyResourceSchema = z.object({
  ...companyResourceBaseShape,
  type: z.literal("assignment"),
  attributes: z
    .object({
      employeeId: companyIdentifierSchema,
      employmentId: companyIdentifierSchema,
      organizationUnitId: companyIdentifierSchema,
      assignmentType: z.enum(orgAssignmentTypes),
      positionTitle: z.string().trim().min(1).max(200).nullable().optional(),
    })
    .catchall(companyJsonSchema),
})
