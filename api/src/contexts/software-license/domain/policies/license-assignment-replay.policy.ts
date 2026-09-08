import type { LicenseAssignmentProps } from "@/contexts/software-license/domain/schemas/license-assignment.schema"

/** 同じ記録者による同じ割当の再送だけを既存記録に結び付ける。 */
export function isLicenseAssignmentReplay(
  stored: LicenseAssignmentProps,
  command: Readonly<{
    licenseId: number
    employeeId: string
    accountReference: string | null
    reason: string
    accountId: string
  }>,
): boolean {
  return (
    stored.license_id === command.licenseId &&
    stored.employee_id === command.employeeId &&
    stored.account_reference === command.accountReference &&
    stored.assigned_reason === command.reason &&
    stored.assigned_by === command.accountId
  )
}
