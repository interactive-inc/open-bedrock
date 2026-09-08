import type { LicenseEntity } from "@/contexts/software-license/domain/entities/license.entity"
import { licenseResponseSchema } from "@/contexts/software-license/interface/http/response-schemas"

/** 公開する契約情報を検査する。 */
export function toLicenseResponse(license: LicenseEntity) {
  return licenseResponseSchema.parse({
    id: license.id,
    name: license.name,
    vendor: license.vendor,
    category: license.category,
    plan_name: license.planName,
    revision: license.revision,
    seats: license.seats,
    renewal_deadline: license.renewalDeadline,
    owner_employee_id: license.ownerEmployeeId,
    note: license.note,
    status: license.status,
    created_at: license.createdAt,
  })
}
