import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

/** 現行storage adapterのcanonical Employee IDを既存数値主キーへ戻す。 */
export function toStorageEmployeeId(employeeId: EmployeeId): number | Error {
  const match = /^employee:(0|[1-9]\d*)$/.exec(String(employeeId))
  if (match === null) return new Error("canonical Employee ID cannot be mapped to storage")

  const value = Number(match[1])
  return Number.isSafeInteger(value) && value > 0
    ? value
    : new Error("canonical Employee ID cannot be mapped to storage")
}
