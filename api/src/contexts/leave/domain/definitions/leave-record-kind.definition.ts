import { z } from "zod"

export const leaveRecordKinds = [
  "leave-request-record",
  "leave-balance-record",
  "leave-procedure-binding-record",
  "leave-decision-notification-record",
] as const

export const leaveRecordKindSchema = z.enum(leaveRecordKinds)
export type LeaveRecordKind = z.infer<typeof leaveRecordKindSchema>

export function encodeLeaveBalanceRecordId(
  employeeId: string | number,
  fiscalYear: string,
  leaveType: string,
): string {
  return `${encodeURIComponent(String(employeeId))}:${encodeURIComponent(fiscalYear)}:${encodeURIComponent(leaveType)}`
}

export function decodeLeaveBalanceRecordId(recordId: string) {
  const parts = recordId.split(":")
  if (parts.length !== 3) return null
  try {
    const employeeId = decodeURIComponent(parts[0] ?? "")
    const fiscalYear = decodeURIComponent(parts[1] ?? "")
    const leaveType = decodeURIComponent(parts[2] ?? "")
    if (
      employeeId === "" ||
      fiscalYear === "" ||
      leaveType === "" ||
      encodeLeaveBalanceRecordId(employeeId, fiscalYear, leaveType) !== recordId
    )
      return null
    return { employeeId, fiscalYear, leaveType }
  } catch {
    return null
  }
}
