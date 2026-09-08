import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

export const licenseAssignmentSchema = z
  .object({
    id: z.string().uuid(),
    license_id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    employee_id: zEmployeeId,
    service_name: z.string().min(1),
    plan_name: z.string().nullable(),
    account_reference: z.string().trim().min(1).max(300).nullable(),
    assigned_at: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    assigned_by: zAccountId,
    assigned_reason: z.string().trim().min(1).max(1000),
    released_at: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
    released_by: zAccountId.nullable(),
    release_reason: z.string().trim().min(1).max(1000).nullable(),
  })
  .strict()
  .refine((p) =>
    p.released_at === null
      ? p.released_by === null && p.release_reason === null
      : p.released_at >= p.assigned_at && p.released_by !== null && p.release_reason !== null,
  )

export type LicenseAssignmentProps = Readonly<z.infer<typeof licenseAssignmentSchema>>
