import type { ProcedureKey } from "@system/domain/workflow/procedure-definition.entity"
import type { DelegationId } from "@system/domain/workflow/delegation.entity"
import { systemDelegations } from "@system/infrastructure/schema/system-workflow"
import { systemProcedureDefinitions } from "@system/infrastructure/schema/system-procedure"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** System Delegationを特定のProcedureへ限定する任意scope。 */
export const systemDelegationProcedureScopes = sqliteTable(
  "system_delegation_procedure_scopes",
  {
    delegationId: text("delegation_id")
      .primaryKey()
      .$type<DelegationId>()
      .references(() => systemDelegations.id, { onDelete: "restrict" }),
    procedureKey: text("procedure_key")
      .notNull()
      .$type<ProcedureKey>()
      .references(() => systemProcedureDefinitions.key, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("system_delegation_procedure_scopes_pair_uniq").on(
      table.delegationId,
      table.procedureKey,
    ),
  ],
)

/** 外部互換API向けの変更不能な単調Delegation番号。 */
export const systemDelegationNumbers = sqliteTable(
  "system_delegation_numbers",
  {
    number: integer("number").primaryKey({ autoIncrement: true }),
    delegationId: text("delegation_id")
      .notNull()
      .$type<DelegationId>()
      .references(() => systemDelegations.id, { onDelete: "restrict" }),
  },
  (table) => [uniqueIndex("system_delegation_numbers_delegation_uniq").on(table.delegationId)],
)

export const systemProcedureDelegationSchema = {
  systemDelegationNumbers,
  systemDelegationProcedureScopes,
}
