import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { RingiStatus } from "@/contexts/ringi/domain/definitions/ringi-status.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { systemWorkflowTableReferences } from "@system/interface/operations/system-workflow-table-references"

/** 起案時の提出先と業務上の決裁結果を保持する稟議。 */
export const ringiRequests = sqliteTable(
  "ringi_requests",
  {
    id: text("id").primaryKey().notNull(),
    applicantId: text("applicant_id").$type<EmployeeId>().notNull(),
    approverId: text("approver_id").$type<EmployeeId>().notNull(),
    title: text("title").notNull(),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().$type<RingiStatus>(),
    decidedAt: text("decided_at"),
    decisionComment: text("decision_comment"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("ringi_requests_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type RingiRequestRow = InferSelectModel<typeof ringiRequests>

/** 業務稟議と、確認対象を固定したSystem案件の不変な対応。 */
export const ringiProcedureBindings = sqliteTable(
  "ringi_procedure_bindings",
  {
    /** 結び付けの主キー。冪等性キー request_key は System の案件の subject なので一意な属性として残す。 */
    id: text("id").primaryKey().notNull(),
    previousRingiId: text("previous_ringi_id")
      .unique()
      .references(() => ringiRequests.id, { onDelete: "restrict" }),
    requestKey: text("request_key").notNull().unique(),
    ringiId: text("ringi_id")
      .notNull()
      .unique()
      .references(() => ringiRequests.id, { onDelete: "restrict" }),
    applicationId: integer("application_id")
      .notNull()
      .unique()
      .references(systemWorkflowTableReferences.proposalNumber, { onDelete: "restrict" }),
    seriesId: text("series_id")
      .notNull()
      .unique()
      .references(systemWorkflowTableReferences.proposalSeriesId, { onDelete: "restrict" }),
    caseId: text("case_id")
      .notNull()
      .unique()
      .references(systemWorkflowTableReferences.caseId, { onDelete: "restrict" }),
    proposalDigest: text("proposal_digest").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  () => [check("ringi_procedure_bindings_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)
