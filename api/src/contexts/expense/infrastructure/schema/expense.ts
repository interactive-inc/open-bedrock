import type { ExpenseApprovalAction, ExpenseCategory, ExpenseStatus } from "@/lib/schemas"
import type { InferSelectModel } from "drizzle-orm"
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 経費申請（申請者・カテゴリ・金額・ステータス）。 */
export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
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
  approverId: integer("approver_id").notNull(),
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
