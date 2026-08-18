import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** Product APIの数値Account/Employee projectionを保持するappend-only監査event。 */
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

/** 監査付きbatch transaction内でだけ使う排他的decision marker。 */
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

/** Company: System 監査イベントへ Employee 文脈を付与する append-only satellite。 */
export const auditEventEmployeeContexts = sqliteTable(
  "audit_event_employee_contexts",
  {
    auditEventId: integer("audit_event_id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
  },
  (table) => [
    index("idx_audit_event_employee_contexts_employee").on(table.employeeId, table.auditEventId),
  ],
)

export type AuditEventEmployeeContextRow = InferSelectModel<typeof auditEventEmployeeContexts>
