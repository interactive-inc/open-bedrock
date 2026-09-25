import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
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
import { systemWorkflowTableReferences } from "@system/interface/operations/system-workflow-table-references"
import { organizationUnits } from "@/contexts/company/infrastructure/schema/organization"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core"

/** 経費申請（申請者・カテゴリ・金額・ステータス）。 */
export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey().notNull(),
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
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("expenses_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type ExpenseRow = InferSelectModel<typeof expenses>

/** 経費への承認/却下アクションの記録。 */
export const expenseApprovals = sqliteTable(
  "expense_approvals",
  {
    id: text("id").primaryKey().notNull(),
    expenseId: text("expense_id").notNull(),
    approverId: text("approver_id")
      .$type<EmployeeId>()
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    action: text("action").notNull().$type<ExpenseApprovalAction>(),
    comment: text("comment"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("expense_approvals_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type ExpenseApprovalRow = InferSelectModel<typeof expenseApprovals>

/**
 * 経費と添付の対応。どの経費がどの添付を持つかは経費contextが所有し、
 * 添付本体と復号鍵は System が持つ（System は経費を知らない）。
 */
export const expenseAttachments = sqliteTable(
  "expense_attachments",
  {
    id: text("id").primaryKey().notNull(),
    expenseId: text("expense_id").notNull(),
    attachmentId: text("attachment_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("expense_attachments_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    unique().on(table.expenseId, table.attachmentId),
    index("idx_expense_attachments_expense").on(table.expenseId),
  ],
)

export type ExpenseAttachmentRow = InferSelectModel<typeof expenseAttachments>

/** 経費と変更不能な承認対象・添付の対応。 */
export const expenseProcedureBindings = sqliteTable(
  "expense_procedure_bindings",
  {
    id: text("id").primaryKey().notNull(),
    requestKey: text("request_key").notNull().unique(),
    expenseId: text("expense_id")
      .notNull()
      .unique()
      .references(() => expenses.id, { onDelete: "restrict" }),
    previousExpenseId: text("previous_expense_id")
      .unique()
      .references(() => expenses.id, { onDelete: "restrict" }),
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
    attachmentEvidenceJson: text("attachment_evidence_json").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  () => [check("expense_procedure_bindings_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)
