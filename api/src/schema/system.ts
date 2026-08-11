import type { AccountStatus } from "@/domain/system/auth/account-status"
import type { IdentityProvider } from "@/domain/system/identity/identity-provider"
import type { IdentitySubject } from "@/domain/system/identity/identity-subject"
import type { BatchJobStatus } from "@/domain/system/batch/batch-job-status"
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

/** System の Account 宛て汎用通知。is_read は 0/1 で保存する。 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipientAccountId: integer("recipient_account_id").notNull(),
    sourceDomain: text("source_domain").notNull(),
    sourceId: integer("source_id"),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    isRead: integer("is_read").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_notifications_recipient_unread")
      .on(table.recipientAccountId)
      .where(sql`is_read = 0`),
  ],
)

export type NotificationRow = InferSelectModel<typeof notifications>

/** バッチジョブの実行状況。業務固有の実行内容は name と message の外側で管理する。 */
export const batchJobs = sqliteTable("batch_jobs", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().$type<BatchJobStatus>(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  message: text("message"),
})

export type BatchJobRow = InferSelectModel<typeof batchJobs>

/** System: 認証主体。上位コンテキストの主体を参照しない。 */
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey(),
  status: text("status").notNull().$type<AccountStatus>(),
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

export type AccountRow = InferSelectModel<typeof accounts>

/** IAM: ログイン手段。password は secret に PBKDF2、OAuth は subject に sub。 */
export const identities = sqliteTable(
  "identities",
  {
    id: integer("id").primaryKey(),
    accountId: integer("account_id").notNull(),
    provider: text("provider").notNull().$type<IdentityProvider>(),
    subject: text("subject").notNull().$type<IdentitySubject>(),
    secret: text("secret"),
    email: text("email"),
    emailVerified: integer("email_verified").notNull().default(0),
    lastUsedAt: integer("last_used_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uniq_identities_provider_subject").on(table.provider, table.subject),
    index("idx_identities_account").on(table.accountId),
  ],
)

export type IdentityRow = InferSelectModel<typeof identities>

/** 外部 identity provider の短命トークンの使用済み jti。 */
export const identityLoginJti = sqliteTable(
  "identity_login_tokens",
  {
    jti: text("jti").primaryKey(),
    expiresAt: integer("expires_at").notNull(),
    usedAt: integer("used_at").notNull(),
  },
  (table) => [index("idx_identity_login_jti_expires").on(table.expiresAt)],
)

export type IdentityLoginJtiRow = InferSelectModel<typeof identityLoginJti>

/** CLI ログインの one-time state。 */
export const cliLoginStates = sqliteTable(
  "cli_login_states",
  {
    state: text("state").primaryKey(),
    port: integer("port").notNull(),
    cliState: text("cli_state").notNull(),
    codeVerifier: text("code_verifier").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("idx_cli_login_states_expires").on(table.expiresAt)],
)

export type CliLoginStateRow = InferSelectModel<typeof cliLoginStates>

/** CLI ログインの one-time code。トークンを保持せず Account だけを受け渡す。 */
export const cliLoginCodes = sqliteTable(
  "cli_login_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    accountId: integer("account_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("idx_cli_login_codes_expires").on(table.expiresAt)],
)

export type CliLoginCodeRow = InferSelectModel<typeof cliLoginCodes>

/** ブラウザログインの one-time code。 */
export const browserLoginCodes = sqliteTable(
  "browser_login_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    accountId: integer("account_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("idx_browser_login_codes_expires").on(table.expiresAt)],
)

export type BrowserLoginCodeRow = InferSelectModel<typeof browserLoginCodes>

/** IAM: ロール。system role は is_system=1 で key 改名・削除不可。 */
export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: integer("is_system").notNull().default(0),
  createdAt: integer("created_at").notNull(),
})

export type RoleRow = InferSelectModel<typeof roles>

/** IAM: 権限カタログ。 */
export const permissions = sqliteTable("permissions", {
  id: integer("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull(),
})

export type PermissionRow = InferSelectModel<typeof permissions>

/** IAM: ロールが持つ権限。 */
export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: integer("role_id").notNull(),
    permissionId: integer("permission_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
)

export type RolePermissionRow = InferSelectModel<typeof rolePermissions>

/** IAM: Account に割り当てたロール。 */
export const accountRoles = sqliteTable(
  "account_roles",
  {
    accountId: integer("account_id").notNull(),
    roleId: integer("role_id").notNull(),
    grantedBy: integer("granted_by"),
    grantedAt: integer("granted_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.roleId] })],
)

export type AccountRoleRow = InferSelectModel<typeof accountRoles>

/** IAM: refresh token。生は保存せず SHA-256 のみ。 */
export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: integer("id").primaryKey(),
    accountId: integer("account_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    familyId: text("family_id").notNull(),
    tokenVersion: integer("token_version").notNull().default(0),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_refresh_tokens_account").on(table.accountId),
    index("idx_refresh_tokens_active_family")
      .on(table.familyId)
      .where(sql`revoked_at IS NULL`),
  ],
)

export type RefreshTokenRow = InferSelectModel<typeof refreshTokens>

/** Account 主体の append-only 監査イベント。 */
export const auditLogs = sqliteTable(
  "audit_events",
  {
    id: integer("id").primaryKey(),
    eventId: text("event_id").notNull().unique(),
    requestId: text("request_id").notNull(),
    actorAccountId: integer("actor_account_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    outcome: text("outcome").notNull().$type<"succeeded" | "denied" | "failed">(),
    reasonCode: text("reason_code"),
    authorizationJson: text("authorization_json"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json"),
    clientIp: text("client_ip"),
    clientName: text("client_name").notNull().$type<"web" | "cli" | "api" | "system">(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_audit_logs_request").on(table.requestId),
    index("idx_audit_logs_actor").on(table.actorAccountId, table.createdAt, table.id),
    index("idx_audit_logs_action").on(table.action, table.createdAt, table.id),
    index("idx_audit_logs_target").on(table.targetType, table.targetId, table.createdAt, table.id),
    index("idx_audit_logs_outcome").on(table.outcome, table.createdAt, table.id),
    index("idx_audit_logs_created").on(table.createdAt, table.id),
  ],
)

export type AuditLogRow = InferSelectModel<typeof auditLogs>

/** 監査付き batch の transaction 内だけで使う排他的 decision marker。 */
export const auditBatchDecisions = sqliteTable(
  "audit_batch_decisions",
  {
    decisionId: text("decision_id").primaryKey(),
    decisionValue: text("decision_value").notNull(),
  },
  (table) => [
    check(
      "audit_batch_decisions_decision_id_length",
      sql`length(${table.decisionId}) BETWEEN 1 AND 200`,
    ),
    check(
      "audit_batch_decisions_decision_value_length",
      sql`length(${table.decisionValue}) BETWEEN 1 AND 64`,
    ),
  ],
)

export type AuditBatchDecisionRow = InferSelectModel<typeof auditBatchDecisions>

export const systemSchema = {
  accounts,
  identities,
  identityLoginJti,
  cliLoginStates,
  cliLoginCodes,
  browserLoginCodes,
  roles,
  permissions,
  rolePermissions,
  accountRoles,
  refreshTokens,
  auditLogs,
  auditBatchDecisions,
  batchJobs,
  notifications,
}
