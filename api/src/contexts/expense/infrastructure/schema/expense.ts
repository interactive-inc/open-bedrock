import type {
  EmployeeId,
  OrganizationUnitId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import type {
  ExpenseApprovalAction,
  ExpenseCategory,
  ExpenseStatus,
} from "@/contexts/expense/domain/definitions/expense.definition"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { systemCases } from "@system/infrastructure/schema/system-workflow"
import {
  systemProposalNumbers,
  systemProposalSeries,
} from "@system/infrastructure/schema/system-procedure"
import { organizationUnits } from "@/contexts/company/infrastructure/schema/organization"
import type { InferSelectModel } from "drizzle-orm"
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 経費申請（申請者・カテゴリ・金額・ステータス）。 */
export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: text("employee_id")
    .$type<EmployeeId>()
    .notNull()
    .references(() => employees.id, { onDelete: "restrict" }),
  organizationUnitId: text("organization_unit_id")
    .$type<OrganizationUnitId>()
    .notNull()
    .references(() => organizationUnits.id, { onDelete: "restrict" }),
  category: text("category").notNull().$type<ExpenseCategory>(),
  amount: integer("amount").notNull(),
  spentAt: text("spent_at").notNull(),
  note: text("note"),
  status: text("status").notNull().$type<ExpenseStatus>(),
  createdAt: text("created_at").notNull(),
})

export type ExpenseRow = InferSelectModel<typeof expenses>

/** 経費への承認/却下アクションの記録。 */
export const expenseApprovals = sqliteTable("expense_approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id").notNull(),
  approverId: text("approver_id")
    .$type<EmployeeId>()
    .notNull()
    .references(() => employees.id, { onDelete: "restrict" }),
  action: text("action").notNull().$type<ExpenseApprovalAction>(),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
})

export type ExpenseApprovalRow = InferSelectModel<typeof expenseApprovals>

/**
 * 経費と添付の対応。どの経費がどの添付を持つかは経費contextが所有し、
 * 添付本体と復号鍵は System が持つ（System は経費を知らない）。
 */
export const expenseAttachments = sqliteTable(
  "expense_attachments",
  {
    expenseId: integer("expense_id").notNull(),
    attachmentId: text("attachment_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.expenseId, table.attachmentId] }),
    index("idx_expense_attachments_expense").on(table.expenseId),
  ],
)

export type ExpenseAttachmentRow = InferSelectModel<typeof expenseAttachments>

/** 経費と変更不能な承認対象・添付の対応。 */
export const expenseProcedureBindings = sqliteTable("expense_procedure_bindings", {
  requestKey: text("request_key").primaryKey(),
  expenseId: integer("expense_id")
    .notNull()
    .unique()
    .references(() => expenses.id, { onDelete: "restrict" }),
  previousExpenseId: integer("previous_expense_id")
    .unique()
    .references(() => expenses.id, { onDelete: "restrict" }),
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
  attachmentEvidenceJson: text("attachment_evidence_json").notNull(),
  createdAt: integer("created_at").notNull(),
})
