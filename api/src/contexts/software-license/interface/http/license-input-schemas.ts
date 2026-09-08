import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

export const licenseIdSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER)
export const licenseInputSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    plan_name: z.string().trim().min(1).max(300).nullable().optional(),
    vendor: z.string().max(300).nullable().optional(),
    category: z.enum(["saas", "software", "other"]).nullable().optional(),
    seats: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
    renewal_deadline: z.iso.date().nullable().optional(),
    owner_employee_id: zEmployeeId.nullable().optional(),
    note: z.string().max(3000).nullable().optional(),
  })
  .strict()
export const licenseListQuerySchema = z.object({
  status: z.enum(["active", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
})
