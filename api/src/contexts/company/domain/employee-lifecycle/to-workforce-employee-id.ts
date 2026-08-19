import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

export function toWorkforceEmployeeId(value: number): EmployeeId {
  return restoreWorkforceId("employee", `employee:${value}`)
}
