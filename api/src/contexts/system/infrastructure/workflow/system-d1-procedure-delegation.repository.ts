import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import type {
  SystemProcedureDelegationRepository,
  SystemProcedureDelegationView,
} from "@system/infrastructure/workflow/system-procedure-delegation-port.repository"
import { zAccountId } from "@system/domain/auth/account-id"
import { procedureKeySchema } from "@system/domain/workflow/procedure-definition.entity"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context.repository"

type DelegationRow = Readonly<{
  number: number
  id: string
  delegator_account_id: string
  delegate_account_id: string
  procedure_key: string | null
  starts_at: number
  ends_at: number
  revoked_at: number | null
  created_at: number
}>

/** Procedure scope付きSystem Delegationを原子的に永続化する。 */
export class SystemD1ProcedureDelegationRepository implements SystemProcedureDelegationRepository {
  constructor(private readonly context: SystemD1Context) {}

  async create(
    input: Parameters<SystemProcedureDelegationRepository["create"]>[0],
  ): Promise<SystemProcedureDelegationView | "overlap" | Error> {
    if (
      input.delegatorAccountId === input.delegateAccountId ||
      input.endsAt.getTime() <= input.startsAt.getTime() ||
      input.createdAt.getTime() > input.startsAt.getTime()
    ) {
      return new Error("invalid System delegation")
    }
    const id = crypto.randomUUID()
    const database = this.context.env.DB
    try {
      const overlap = await database
        .prepare(
          `SELECT 1 AS found
         FROM system_delegations AS existing
         LEFT JOIN system_delegation_procedure_scopes AS existing_scope
           ON existing_scope.delegation_id = existing.id
         WHERE existing.delegator_account_id = ?1
           AND existing.revoked_at IS NULL
           AND existing.starts_at < ?3
           AND existing.ends_at > ?2
           AND (
             ?4 IS NULL
             OR existing_scope.procedure_key IS NULL
             OR existing_scope.procedure_key = ?4
           )
         LIMIT 1`,
        )
        .bind(
          input.delegatorAccountId,
          input.startsAt.getTime(),
          input.endsAt.getTime(),
          input.procedureKey,
        )
        .first<number>("found")
      if (overlap === 1) return "overlap"
      const statements: D1PreparedStatement[] = [
        database
          .prepare(
            `INSERT INTO system_delegations
             (id, delegator_account_id, delegate_account_id,
              starts_at, ends_at, created_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6
           WHERE EXISTS (
             SELECT 1 FROM system_accounts WHERE id = ?2 AND status = 'active'
           ) AND EXISTS (
             SELECT 1 FROM system_accounts WHERE id = ?3 AND status = 'active'
           ) AND NOT EXISTS (
             SELECT 1
             FROM system_delegations AS existing
             LEFT JOIN system_delegation_procedure_scopes AS existing_scope
               ON existing_scope.delegation_id = existing.id
             WHERE existing.delegator_account_id = ?2
               AND existing.revoked_at IS NULL
               AND existing.starts_at < ?5
               AND existing.ends_at > ?4
               AND (
                 ?7 IS NULL
                 OR existing_scope.procedure_key IS NULL
                 OR existing_scope.procedure_key = ?7
               )
           )`,
          )
          .bind(
            id,
            input.delegatorAccountId,
            input.delegateAccountId,
            input.startsAt.getTime(),
            input.endsAt.getTime(),
            input.createdAt.getTime(),
            input.procedureKey,
          ),
        abortWhenPreviousStatementChangedNoRows(database),
      ]
      if (input.procedureKey !== null) {
        statements.push(
          database
            .prepare(
              `INSERT INTO system_delegation_procedure_scopes
               (delegation_id, procedure_key)
             VALUES (?1, ?2)`,
            )
            .bind(id, input.procedureKey),
        )
      }
      statements.push(
        database
          .prepare("INSERT INTO system_delegation_numbers (delegation_id) VALUES (?1)")
          .bind(id),
        database
          .prepare(
            `SELECT number.number, delegation.id, delegation.delegator_account_id,
                  delegation.delegate_account_id, procedure_scope.procedure_key,
                  delegation.starts_at, delegation.ends_at, delegation.revoked_at,
                  delegation.created_at
           FROM system_delegations AS delegation
           JOIN system_delegation_numbers AS number
             ON number.delegation_id = delegation.id
           LEFT JOIN system_delegation_procedure_scopes AS procedure_scope
             ON procedure_scope.delegation_id = delegation.id
           WHERE delegation.id = ?1`,
          )
          .bind(id),
      )
      const results = await database.batch<DelegationRow>(statements)
      const row = results.at(-1)?.results.at(0)
      return row === undefined ? new Error("System delegation is missing") : this.restore(row)
    } catch (cause) {
      if (isAbortedByGuard(cause)) return "overlap"
      return cause instanceof Error
        ? cause
        : new Error("failed to create System delegation", { cause })
    }
  }

  async list(
    accountId: Parameters<SystemProcedureDelegationRepository["list"]>[0],
  ): Promise<ReadonlyArray<SystemProcedureDelegationView> | Error> {
    try {
      const rows = await this.context.env.DB.prepare(
        `SELECT number.number, delegation.id, delegation.delegator_account_id,
                delegation.delegate_account_id, procedure_scope.procedure_key,
                delegation.starts_at, delegation.ends_at, delegation.revoked_at,
                delegation.created_at
         FROM system_delegations AS delegation
         JOIN system_delegation_numbers AS number ON number.delegation_id = delegation.id
         LEFT JOIN system_delegation_procedure_scopes AS procedure_scope
           ON procedure_scope.delegation_id = delegation.id
         WHERE delegation.delegator_account_id = ?1 OR delegation.delegate_account_id = ?1
         ORDER BY delegation.starts_at, number.number`,
      )
        .bind(accountId)
        .all<DelegationRow>()
      const result: SystemProcedureDelegationView[] = []
      for (const row of rows.results) {
        const restored = this.restore(row)
        if (restored instanceof Error) return restored
        result.push(restored)
      }
      return result
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to list System delegations", { cause })
    }
  }

  async revoke(
    input: Parameters<SystemProcedureDelegationRepository["revoke"]>[0],
  ): Promise<true | "not_found" | Error> {
    try {
      const result = await this.context.env.DB.prepare(
        `UPDATE system_delegations
         SET revoked_at = ?3
         WHERE id = (
           SELECT delegation_id FROM system_delegation_numbers WHERE number = ?1
         )
           AND delegator_account_id = ?2
           AND revoked_at IS NULL
           AND ?3 >= created_at
           AND ?3 <= ends_at
         RETURNING id`,
      )
        .bind(input.number, input.delegatorAccountId, input.revokedAt.getTime())
        .first<string>("id")

      return result === null ? "not_found" : true
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to revoke System delegation", { cause })
    }
  }

  private restore(row: DelegationRow): SystemProcedureDelegationView | Error {
    const delegatorAccountId = zAccountId.safeParse(row.delegator_account_id)
    const delegateAccountId = zAccountId.safeParse(row.delegate_account_id)
    const procedureKey =
      row.procedure_key === null ? null : procedureKeySchema.safeParse(row.procedure_key)
    if (
      !delegatorAccountId.success ||
      !delegateAccountId.success ||
      (procedureKey !== null && !procedureKey.success)
    ) {
      return new Error("System delegation contains invalid identity data")
    }

    return {
      number: row.number,
      id: row.id,
      delegatorAccountId: delegatorAccountId.data,
      delegateAccountId: delegateAccountId.data,
      procedureKey: procedureKey === null ? null : procedureKey.data,
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
      revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
      createdAt: new Date(row.created_at),
    }
  }
}
