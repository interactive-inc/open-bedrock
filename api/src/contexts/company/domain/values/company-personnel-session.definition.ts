import type { AccountId } from "@system/domain/values/account-id.schema"

export type CompanyPersonnelSession = Readonly<{
  accountId: AccountId
  employeeId: number
  hasPermission(permission: string): boolean
}>
