import { restoreWorkforceId } from "@/contexts/company/domain/values/restore-workforce-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/values/workforce-id.definition"

export function toWorkforceEmployeeId(value: number): EmployeeId {
  return restoreWorkforceId("employee", `employee:${value}`)
}
