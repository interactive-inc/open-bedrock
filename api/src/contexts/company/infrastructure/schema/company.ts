import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { systemAccounts } from "@system/infrastructure/schema/system-core"

/** Company全体のoptimistic revision。全writeはこのrevisionをCASする。 */
export const companyOrganizations = sqliteTable("company_organizations", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  name: text("name").notNull(),
  representativeName: text("representative_name").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

/** Company内でAccountを表示するときのプロフィール。認証主体のSystem Accountへ表示名を持たせない。 */
export const companyAccountProfiles = sqliteTable(
  "company_account_profiles",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => companyOrganizations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    accountId: text("account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.accountId] }),
    index("company_account_profiles_account_idx").on(table.accountId),
    check(
      "company_account_profiles_display_name",
      sql`length(${table.displayName}) BETWEEN 1 AND 200
          AND trim(${table.displayName}) = ${table.displayName}
          AND instr(${table.displayName}, char(0)) = 0`,
    ),
    check(
      "company_account_profiles_chronology",
      sql`${table.createdAt} >= 0 AND ${table.updatedAt} >= ${table.createdAt}`,
    ),
  ],
)

/** 各Company resourceの現在projection。履歴はcompanyResourceRevisionsだけへ追記する。 */
export const companyResourceHeads = sqliteTable(
  "company_resource_heads",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => companyOrganizations.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    revision: integer("revision").notNull(),
    organizationRevision: integer("organization_revision").notNull(),
    state: text("state").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    attributesJson: text("attributes_json").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.organizationId, table.resourceType, table.resourceId],
    }),
    index("company_resource_heads_type_effective_idx").on(
      table.organizationId,
      table.resourceType,
      table.effectiveFrom,
      table.effectiveTo,
    ),
    uniqueIndex("company_resource_heads_org_revision_idx").on(
      table.organizationId,
      table.organizationRevision,
      table.resourceType,
      table.resourceId,
    ),
    check("company_resource_heads_revision_positive", sql`${table.revision} >= 1`),
    check("company_resource_heads_state_valid", sql`${table.state} IN ('active', 'void')`),
    check(
      "company_resource_heads_period_valid",
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
)

/** 訂正も削除も上書きせず、新revisionとして追記する監査可能な正本。 */
export const companyResourceRevisions = sqliteTable(
  "company_resource_revisions",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => companyOrganizations.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    revision: integer("revision").notNull(),
    organizationRevision: integer("organization_revision").notNull(),
    state: text("state").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    attributesJson: text("attributes_json").notNull(),
    commandId: text("command_id").notNull(),
    actorAccountId: text("actor_account_id").notNull(),
    reason: text("reason").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.organizationId, table.resourceType, table.resourceId, table.revision],
    }),
    uniqueIndex("company_resource_revisions_org_revision_idx").on(
      table.organizationId,
      table.organizationRevision,
      table.resourceType,
      table.resourceId,
    ),
    index("company_resource_revisions_command_idx").on(table.organizationId, table.commandId),
    check("company_resource_revisions_revision_positive", sql`${table.revision} >= 1`),
    check("company_resource_revisions_state_valid", sql`${table.state} IN ('active', 'void')`),
    check(
      "company_resource_revisions_period_valid",
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
)

/** idempotencyとoptimistic lockを同じtransaction内で確定するcommand receipt。 */
export const companyCommandReceipts = sqliteTable(
  "company_command_receipts",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => companyOrganizations.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    commandId: text("command_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    expectedRevision: integer("expected_revision").notNull(),
    organizationRevision: integer("organization_revision").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.commandId] }),
    check(
      "company_command_receipts_revision_valid",
      sql`${table.expectedRevision} >= 0 AND ${table.organizationRevision} > ${table.expectedRevision}`,
    ),
  ],
)

export const companySchema = {
  companyOrganizations,
  companyAccountProfiles,
  companyResourceHeads,
  companyResourceRevisions,
  companyCommandReceipts,
}
