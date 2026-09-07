import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { RingiStatus } from "@/contexts/ringi/domain/definitions/ringi-status.definition"
import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { systemCases } from "@system/infrastructure/schema/system-workflow"
import {
  systemProposalNumbers,
  systemProposalSeries,
} from "@system/infrastructure/schema/system-procedure"

/** 起案時の提出先と業務上の決裁結果を保持する稟議。 */
export const ringiRequests = sqliteTable("ringi_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicantId: text("applicant_id").$type<EmployeeId>().notNull(),
  approverId: text("approver_id").$type<EmployeeId>().notNull(),
  title: text("title").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().$type<RingiStatus>(),
  decidedAt: text("decided_at"),
  decisionComment: text("decision_comment"),
  createdAt: text("created_at").notNull(),
})

export type RingiRequestRow = InferSelectModel<typeof ringiRequests>

/** 業務稟議と、確認対象を固定したSystem案件の不変な対応。 */
export const ringiProcedureBindings = sqliteTable("ringi_procedure_bindings", {
  requestKey: text("request_key").primaryKey(),
  ringiId: integer("ringi_id")
    .notNull()
    .unique()
    .references(() => ringiRequests.id, { onDelete: "restrict" }),
  applicationId: integer("application_id")
    .notNull()
    .unique()
    .references(() => systemProposalNumbers.number, { onDelete: "restrict" }),
  seriesId: text("series_id")
    .notNull()
    .unique()
    .references(() => systemProposalSeries.id, { onDelete: "restrict" }),
  caseId: text("case_id")
    .notNull()
    .unique()
    .references(() => systemCases.id, { onDelete: "restrict" }),
  proposalDigest: text("proposal_digest").notNull(),
  createdAt: integer("created_at").notNull(),
})
