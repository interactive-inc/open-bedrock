import type { AccountId } from "@system/domain/auth/account-id"
import type { IamRole } from "@system/domain/iam/iam-role.entity"
import type { RoleBinding } from "@system/domain/iam/role-binding.entity"

export type SystemAuthorizationGraph = Readonly<{
  roles: ReadonlyArray<IamRole>
  bindings: ReadonlyArray<RoleBinding>
}>

export type SystemAuthorizationRepository = Readonly<{
  loadForAccount(accountId: AccountId): Promise<SystemAuthorizationGraph | null | Error>
}>
