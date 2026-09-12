import { organizationUnits } from "@/contexts/company/infrastructure/schema/organization"
import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { systemAccounts, systemIdentityBindings } from "@system/infrastructure/schema/system-core"
import { systemMachineCredentials } from "@system/infrastructure/schema/system-principal"
import { employees } from "@/contexts/company/infrastructure/schema/employee"

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
    uniqueIndex("company_profile_organization_identity")
      .on(table.organizationId)
      .where(sql`${table.resourceType} = 'company-profile'`),
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
    index("company_resource_revisions_org_revision_idx").on(
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

/** 公開resourceの所有者と、同じtransactionで反映したEmployeeの版を固定する。 */
export const companyWorkforceResourceBindings = sqliteTable(
  "company_workforce_resource_bindings",
  {
    resourceType: text("resource_type", { enum: ["employee", "employment"] }).notNull(),
    resourceId: text("resource_id").notNull(),
    organizationId: text("organization_id").notNull(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    resourceRevision: integer("resource_revision").notNull(),
    lifecycleRevision: integer("lifecycle_revision").notNull(),
    lastActionId: text("last_action_id"),
  },
  (table) => [
    primaryKey({ columns: [table.resourceType, table.resourceId] }),
    foreignKey({
      columns: [table.organizationId, table.resourceType, table.resourceId],
      foreignColumns: [
        companyResourceHeads.organizationId,
        companyResourceHeads.resourceType,
        companyResourceHeads.resourceId,
      ],
    }).onDelete("restrict"),
    index("company_workforce_resource_bindings_employee_idx").on(
      table.employeeId,
      table.resourceType,
    ),
    check(
      "company_workforce_resource_binding_type",
      sql`${table.resourceType} IN ('employee', 'employment')`,
    ),
    check(
      "company_workforce_resource_binding_owner",
      sql`${table.resourceType} != 'employee' OR ${table.resourceId} = ${table.employeeId}`,
    ),
    check("company_workforce_resource_binding_revision", sql`${table.resourceRevision} > 0`),
    check(
      "company_workforce_resource_binding_lifecycle_revision",
      sql`${table.lifecycleRevision} >= 0`,
    ),
  ],
)

export const companyExternalIdentityImports = sqliteTable(
  "company_external_identity_imports",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => companyOrganizations.id, { onDelete: "restrict" }),
    commandId: text("command_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    machineCredentialId: text("machine_credential_id")
      .notNull()
      .references(() => systemMachineCredentials.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    expectedRevision: integer("expected_revision").notNull(),
    organizationRevision: integer("organization_revision").notNull(),
    resultJson: text("result_json").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.commandId] }),
    check(
      "company_external_import_fingerprint",
      sql`length(${table.fingerprint}) = 64 AND ${table.fingerprint} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check("company_external_import_result", sql`json_valid(${table.resultJson})`),
    check("company_external_import_command", sql`length(${table.commandId}) BETWEEN 1 AND 200`),
    check("company_external_import_reason", sql`length(trim(${table.reason})) BETWEEN 1 AND 2000`),
    check("company_external_import_expected_revision", sql`${table.expectedRevision} >= 0`),
    check(
      "company_external_import_revision",
      sql`${table.organizationRevision} = ${table.expectedRevision} + 1`,
    ),
    check("company_external_import_recorded_at", sql`${table.recordedAt} >= 0`),
  ],
)

export const companyExternalIdentitySources = sqliteTable(
  "company_external_identity_sources",
  {
    identityId: text("identity_id")
      .primaryKey()
      .references(() => systemIdentityBindings.id, { onDelete: "restrict" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => companyOrganizations.id, { onDelete: "restrict" }),
    sourceRevision: integer("source_revision").notNull(),
    sourceDigest: text("source_digest").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    check("company_external_source_revision", sql`${table.sourceRevision} > 0`),
    check("company_external_source_updated_at", sql`${table.updatedAt} >= 0`),
    check(
      "company_external_source_digest",
      sql`length(${table.sourceDigest}) = 64 AND ${table.sourceDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
)

export const companyEmployeeResourceAdoptions = sqliteTable(
  "company_employee_resource_adoptions",
  {
    commandId: text("command_id").primaryKey(),
    employeeId: text("employee_id")
      .notNull()
      .unique()
      .references(() => employees.id, { onDelete: "restrict" }),
    fingerprint: text("fingerprint").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    expectedRevision: integer("expected_revision").notNull(),
    organizationRevision: integer("organization_revision").notNull(),
    observedOn: text("observed_on").notNull(),
    snapshotDigest: text("snapshot_digest").notNull(),
    sourceJson: text("source_json").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    check("company_adoption_command", sql`length(${table.commandId}) BETWEEN 1 AND 200`),
    check(
      "company_adoption_fingerprint",
      sql`length(${table.fingerprint}) = 64 AND ${table.fingerprint} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check("company_adoption_reason", sql`length(trim(${table.reason})) BETWEEN 1 AND 1500`),
    check("company_adoption_expected", sql`${table.expectedRevision} >= 0`),
    check(
      "company_adoption_revision",
      sql`${table.organizationRevision} > ${table.expectedRevision} AND ${table.organizationRevision} <= ${table.expectedRevision} + 100`,
    ),
    check("company_adoption_day", sql`length(${table.observedOn}) = 10`),
    check(
      "company_adoption_digest",
      sql`length(${table.snapshotDigest}) = 64 AND ${table.snapshotDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "company_adoption_source",
      sql`json_valid(${table.sourceJson}) AND length(CAST(${table.sourceJson} AS BLOB)) <= 750000`,
    ),
    check("company_adoption_recorded_at", sql`${table.recordedAt} >= 0`),
  ],
)

export const companyOrganizationResourceBindings = sqliteTable(
  "company_organization_resource_bindings",
  {
    organizationUnitId: text("organization_unit_id")
      .primaryKey()
      .references(() => organizationUnits.id, { onDelete: "restrict" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => companyOrganizations.id, { onDelete: "restrict" }),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    check("company_org_binding_default", sql`${table.organizationId} = 'organization:default'`),
    check("company_org_binding_time", sql`${table.recordedAt} >= 0`),
  ],
)

export const companyOrganizationResourceAdoptions = sqliteTable(
  "company_organization_resource_adoptions",
  {
    commandId: text("command_id").primaryKey(),
    organizationUnitId: text("organization_unit_id")
      .notNull()
      .unique()
      .references(() => organizationUnits.id, { onDelete: "restrict" }),
    fingerprint: text("fingerprint").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    expectedRevision: integer("expected_revision").notNull(),
    organizationRevision: integer("organization_revision").notNull(),
    observedOn: text("observed_on").notNull(),
    snapshotDigest: text("snapshot_digest").notNull(),
    sourceJson: text("source_json").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    check("company_org_adoption_command", sql`length(${table.commandId}) BETWEEN 1 AND 200`),
    check(
      "company_org_adoption_fingerprint",
      sql`length(${table.fingerprint}) = 64 AND ${table.fingerprint} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check("company_org_adoption_reason", sql`length(trim(${table.reason})) BETWEEN 1 AND 1000`),
    check("company_org_adoption_expected", sql`${table.expectedRevision} >= 0`),
    check(
      "company_org_adoption_revision",
      sql`${table.organizationRevision} > ${table.expectedRevision} AND ${table.organizationRevision} <= ${table.expectedRevision} + 100`,
    ),
    check("company_org_adoption_day", sql`length(${table.observedOn}) = 10`),
    check(
      "company_org_adoption_digest",
      sql`length(${table.snapshotDigest}) = 64 AND ${table.snapshotDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "company_org_adoption_source",
      sql`json_valid(${table.sourceJson}) AND length(CAST(${table.sourceJson} AS BLOB)) <= 750000`,
    ),
    check("company_org_adoption_recorded_at", sql`${table.recordedAt} >= 0`),
  ],
)

export const companyBootstrapReceipts = sqliteTable(
  "company_bootstrap_receipts",
  {
    commandId: text("command_id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .unique()
      .references(() => companyOrganizations.id),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => systemAccounts.id),
    fingerprint: text("fingerprint").notNull(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id),
    organizationRevision: integer("organization_revision").notNull(),
    declarationJson: text("declaration_json").notNull(),
    sourceJson: text("source_json").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    check("company_bootstrap_command", sql`length(${table.commandId}) BETWEEN 1 AND 200`),
    check("company_bootstrap_default", sql`${table.organizationId} = 'organization:default'`),
    check(
      "company_bootstrap_fingerprint",
      sql`length(${table.fingerprint}) = 64 AND ${table.fingerprint} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check("company_bootstrap_revision", sql`${table.organizationRevision} > 0`),
    check("company_bootstrap_declaration", sql`json_valid(${table.declarationJson})`),
    check(
      "company_bootstrap_source",
      sql`json_valid(${table.sourceJson}) AND length(CAST(${table.sourceJson} AS BLOB)) <= 750000`,
    ),
    check("company_bootstrap_time", sql`${table.recordedAt} >= 0`),
  ],
)

export const companyProfileChangeReceipts = sqliteTable(
  "company_profile_change_receipts",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => companyOrganizations.id),
    commandId: text("command_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => systemAccounts.id),
    organizationRevision: integer("organization_revision").notNull(),
    declarationJson: text("declaration_json").notNull(),
    sourceJson: text("source_json").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.commandId] }),
    foreignKey({
      columns: [table.organizationId, table.commandId],
      foreignColumns: [companyCommandReceipts.organizationId, companyCommandReceipts.commandId],
    }),
    check(
      "company_profile_change_fingerprint",
      sql`length(${table.fingerprint}) = 64 AND ${table.fingerprint} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check("company_profile_change_revision", sql`${table.organizationRevision} > 0`),
    check("company_profile_change_declaration", sql`json_valid(${table.declarationJson})`),
    check("company_profile_change_source", sql`json_valid(${table.sourceJson})`),
    check("company_profile_change_time", sql`${table.recordedAt} >= 0`),
  ],
)

export const companySchema = {
  companyProfileChangeReceipts,
  companyBootstrapReceipts,
  companyOrganizationResourceAdoptions,
  companyOrganizationResourceBindings,
  companyEmployeeResourceAdoptions,
  companyExternalIdentityImports,
  companyExternalIdentitySources,
  companyOrganizations,
  companyAccountProfiles,
  companyResourceHeads,
  companyResourceRevisions,
  companyCommandReceipts,
  companyWorkforceResourceBindings,
}
