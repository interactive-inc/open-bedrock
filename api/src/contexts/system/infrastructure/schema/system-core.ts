import type { AccountStatus } from "@system/domain/auth/account-status"
import type { IdentityProvider } from "@system/domain/identity/identity-provider"
import type { SystemAuditOutcome } from "@system/domain/audit/system-audit-event"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

/** 上位contextを知らない、portableなSystem Account永続化契約。 */
export const systemAccounts = sqliteTable(
  "system_accounts",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull().$type<AccountStatus>(),
    tokenVersion: integer("token_version").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check("system_accounts_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_accounts_status", sql`${table.status} IN ('active', 'suspended', 'locked')`),
    check("system_accounts_token_version", sql`${table.tokenVersion} >= 0`),
    check("system_accounts_chronology", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
)

export type SystemAccountRow = InferSelectModel<typeof systemAccounts>

/** Accountとprovider subjectのbinding。credential/contact projectionは別tableが所有する。 */
export const systemIdentityBindings = sqliteTable(
  "system_identity_bindings",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    provider: text("provider").notNull().$type<IdentityProvider>(),
    subject: text("subject").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_identity_bindings_provider_subject_uniq").on(table.provider, table.subject),
    index("system_identity_bindings_account_idx").on(table.accountId),
    check("system_identity_bindings_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_identity_bindings_provider",
      sql`${table.provider} IN ('password', 'google', 'github', 'oidc')`,
    ),
    check(
      "system_identity_bindings_subject_length",
      sql`length(${table.subject}) BETWEEN 1 AND 2048`,
    ),
    check(
      "system_identity_bindings_activation_chronology",
      sql`${table.activatedAt} IS NULL OR ${table.activatedAt} >= ${table.createdAt}`,
    ),
    check(
      "system_identity_bindings_revocation_chronology",
      sql`${table.revokedAt} IS NULL OR (
        ${table.revokedAt} >= ${table.createdAt}
        AND (${table.activatedAt} IS NULL OR ${table.revokedAt} >= ${table.activatedAt})
      )`,
    ),
  ],
)

export type SystemIdentityBindingRow = InferSelectModel<typeof systemIdentityBindings>

/** password provider固有のsecret projection。encoded hashだけを保存する。 */
export const systemPasswordCredentials = sqliteTable(
  "system_password_credentials",
  {
    identityId: text("identity_id")
      .primaryKey()
      .references(() => systemIdentityBindings.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    changedAt: integer("changed_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "system_password_credentials_hash_length",
      sql`length(${table.passwordHash}) BETWEEN 20 AND 4096`,
    ),
    check(
      "system_password_credentials_chronology",
      sql`${table.changedAt} >= ${table.createdAt} AND ${table.updatedAt} >= ${table.changedAt}`,
    ),
  ],
)

export type SystemPasswordCredentialRow = InferSelectModel<typeof systemPasswordCredentials>

/** raw tokenを持たず、rotation/reuse detectionに必要なhashとfamilyだけを保持する。 */
export const systemSessions = sqliteTable(
  "system_sessions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    familyId: text("family_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenVersion: integer("token_version").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    rotatedAt: integer("rotated_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_sessions_token_hash_uniq").on(table.tokenHash),
    index("system_sessions_account_idx").on(table.accountId, table.createdAt),
    index("system_sessions_active_family_idx")
      .on(table.familyId)
      .where(sql`${table.revokedAt} IS NULL`),
    check("system_sessions_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_sessions_family_id_length", sql`length(${table.familyId}) BETWEEN 1 AND 255`),
    check("system_sessions_hash_length", sql`length(${table.tokenHash}) BETWEEN 32 AND 512`),
    check("system_sessions_token_version", sql`${table.tokenVersion} >= 0`),
    check("system_sessions_expiration", sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      "system_sessions_rotation_chronology",
      sql`${table.rotatedAt} IS NULL OR (
        ${table.rotatedAt} >= ${table.createdAt} AND ${table.rotatedAt} < ${table.expiresAt}
      )`,
    ),
    check(
      "system_sessions_revocation_chronology",
      sql`${table.revokedAt} IS NULL OR (
        ${table.revokedAt} >= ${table.createdAt}
        AND (${table.rotatedAt} IS NULL OR ${table.revokedAt} >= ${table.rotatedAt})
      )`,
    ),
  ],
)

export type SystemSessionRow = InferSelectModel<typeof systemSessions>

/** namespaced permissionを束ねるSystem Role。permission vocabulary自体は各contextが所有する。 */
export const systemIamRoles = sqliteTable(
  "system_iam_roles",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    kind: text("kind", { enum: ["managed", "custom"] }).notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("system_iam_roles_key_uniq").on(table.key),
    check("system_iam_roles_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_iam_roles_key_length", sql`length(${table.key}) BETWEEN 3 AND 100`),
    check("system_iam_roles_kind", sql`${table.kind} IN ('managed', 'custom')`),
    check("system_iam_roles_name_length", sql`length(${table.name}) BETWEEN 1 AND 100`),
    check("system_iam_roles_chronology", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
)

export type SystemIamRoleRow = InferSelectModel<typeof systemIamRoles>

export const systemIamRolePermissions = sqliteTable(
  "system_iam_role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => systemIamRoles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionKey] }),
    check(
      "system_iam_role_permissions_key_length",
      sql`length(${table.permissionKey}) BETWEEN 3 AND 100`,
    ),
  ],
)

export type SystemIamRolePermissionRow = InferSelectModel<typeof systemIamRolePermissions>

/** AccountへRoleをglobalまたはopaque resource単位で割り当てる。 */
export const systemRoleBindings = sqliteTable(
  "system_role_bindings",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    roleId: text("role_id")
      .notNull()
      .references(() => systemIamRoles.id, { onDelete: "restrict" }),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_role_bindings_active_uniq")
      .on(
        table.accountId,
        table.roleId,
        sql`coalesce(${table.resourceType}, '')`,
        sql`coalesce(${table.resourceId}, '')`,
      )
      .where(sql`${table.revokedAt} IS NULL`),
    index("system_role_bindings_account_idx").on(table.accountId, table.createdAt),
    index("system_role_bindings_role_idx").on(table.roleId, table.createdAt),
    index("system_role_bindings_resource_idx").on(table.resourceType, table.resourceId),
    check("system_role_bindings_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_role_bindings_resource_pair",
      sql`(${table.resourceType} IS NULL AND ${table.resourceId} IS NULL) OR (
        ${table.resourceType} IS NOT NULL AND ${table.resourceId} IS NOT NULL
        AND length(${table.resourceType}) BETWEEN 3 AND 100
        AND length(${table.resourceId}) BETWEEN 1 AND 255
      )`,
    ),
    check(
      "system_role_bindings_chronology",
      sql`${table.revokedAt} IS NULL OR ${table.revokedAt} >= ${table.createdAt}`,
    ),
  ],
)

export type SystemRoleBindingRow = InferSelectModel<typeof systemRoleBindings>

/** 受信者と既読状態を持たないimmutableなplain-text notification message。 */
export const systemNotificationMessages = sqliteTable(
  "system_notification_messages",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_notification_messages_source_idx").on(table.sourceType, table.sourceId),
    check("system_notification_messages_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_notification_messages_kind_length", sql`length(${table.kind}) BETWEEN 3 AND 100`),
    check(
      "system_notification_messages_title_length",
      sql`length(${table.title}) BETWEEN 1 AND 200`,
    ),
    check(
      "system_notification_messages_body_length",
      sql`${table.body} IS NULL OR length(${table.body}) BETWEEN 1 AND 10000`,
    ),
    check(
      "system_notification_messages_source_pair",
      sql`(${table.sourceType} IS NULL AND ${table.sourceId} IS NULL) OR (
        ${table.sourceType} IS NOT NULL AND ${table.sourceId} IS NOT NULL
        AND length(${table.sourceType}) BETWEEN 3 AND 100
        AND length(${table.sourceId}) BETWEEN 1 AND 512
      )`,
    ),
  ],
)

export type SystemNotificationMessageRow = InferSelectModel<typeof systemNotificationMessages>

/** concrete Account宛てのdeliveryと単調なread receipt。 */
export const systemNotificationDeliveries = sqliteTable(
  "system_notification_deliveries",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => systemNotificationMessages.id, { onDelete: "restrict" }),
    recipientAccountId: text("recipient_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }).notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_notification_deliveries_message_account_uniq").on(
      table.messageId,
      table.recipientAccountId,
    ),
    index("system_notification_deliveries_account_idx").on(
      table.recipientAccountId,
      table.deliveredAt,
    ),
    index("system_notification_deliveries_unread_idx")
      .on(table.recipientAccountId, table.deliveredAt)
      .where(sql`${table.readAt} IS NULL`),
    check("system_notification_deliveries_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_notification_deliveries_read_chronology",
      sql`${table.readAt} IS NULL OR ${table.readAt} >= ${table.deliveredAt}`,
    ),
  ],
)

export type SystemNotificationDeliveryRow = InferSelectModel<typeof systemNotificationDeliveries>

/** Account lifecycle後も残るappend-onlyなsecurity audit envelope。 */
export const systemAuditEvents = sqliteTable(
  "system_audit_events",
  {
    eventId: text("event_id").primaryKey(),
    actorAccountId: text("actor_account_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    outcome: text("outcome").notNull().$type<SystemAuditOutcome>(),
    reasonCode: text("reason_code"),
    authorizationJson: text("authorization_json"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_audit_events_actor_idx").on(table.actorAccountId, table.occurredAt),
    index("system_audit_events_action_idx").on(table.action, table.occurredAt),
    index("system_audit_events_target_idx").on(table.targetType, table.targetId, table.occurredAt),
    index("system_audit_events_outcome_idx").on(table.outcome, table.occurredAt),
    check("system_audit_events_id_length", sql`length(${table.eventId}) BETWEEN 1 AND 255`),
    check("system_audit_events_action_length", sql`length(${table.action}) BETWEEN 3 AND 200`),
    check(
      "system_audit_events_target_type_length",
      sql`length(${table.targetType}) BETWEEN 1 AND 200`,
    ),
    check(
      "system_audit_events_outcome",
      sql`${table.outcome} IN ('succeeded', 'denied', 'failed')`,
    ),
    check(
      "system_audit_events_authorization_json",
      sql`${table.authorizationJson} IS NULL OR json_valid(${table.authorizationJson})`,
    ),
    check(
      "system_audit_events_before_json",
      sql`${table.beforeJson} IS NULL OR json_valid(${table.beforeJson})`,
    ),
    check(
      "system_audit_events_after_json",
      sql`${table.afterJson} IS NULL OR json_valid(${table.afterJson})`,
    ),
    check(
      "system_audit_events_metadata_json",
      sql`${table.metadataJson} IS NULL OR json_valid(${table.metadataJson})`,
    ),
  ],
)

export type SystemAuditEventRow = InferSelectModel<typeof systemAuditEvents>

/** Account・Identity・global root Bindingだけで完結するsingle-use bootstrap marker。 */
export const systemBootstrapState = sqliteTable(
  "system_bootstrap_state",
  {
    singleton: integer("singleton").primaryKey(),
    completedByAccountId: text("completed_by_account_id")
      .notNull()
      .unique()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    rootBindingId: text("root_binding_id")
      .notNull()
      .unique()
      .references(() => systemRoleBindings.id, { onDelete: "restrict" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [check("system_bootstrap_state_singleton", sql`${table.singleton} = 1`)],
)

export type SystemBootstrapStateRow = InferSelectModel<typeof systemBootstrapState>

export const systemCoreSchema = {
  systemAccounts,
  systemIdentityBindings,
  systemPasswordCredentials,
  systemSessions,
  systemIamRoles,
  systemIamRolePermissions,
  systemRoleBindings,
  systemNotificationMessages,
  systemNotificationDeliveries,
  systemAuditEvents,
  systemBootstrapState,
}
