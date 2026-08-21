import type { AccountId } from "@system/domain/auth/account-id"
import type { ProcedureKey } from "@system/domain/workflow/procedure-definition.entity"

export type SystemProcedureDelegationView = Readonly<{
  number: number
  id: string
  delegatorAccountId: AccountId
  delegateAccountId: AccountId
  procedureKey: ProcedureKey | null
  startsAt: Date
  endsAt: Date
  revokedAt: Date | null
  createdAt: Date
}>

export type SystemProcedureDelegationRepository = Readonly<{
  create(
    input: Readonly<{
      delegatorAccountId: AccountId
      delegateAccountId: AccountId
      procedureKey: ProcedureKey | null
      startsAt: Date
      endsAt: Date
      createdAt: Date
    }>,
  ): Promise<SystemProcedureDelegationView | "overlap" | Error>
  list(accountId: AccountId): Promise<ReadonlyArray<SystemProcedureDelegationView> | Error>
  revoke(
    input: Readonly<{
      number: number
      delegatorAccountId: AccountId
      revokedAt: Date
    }>,
  ): Promise<true | "not_found" | Error>
}>
