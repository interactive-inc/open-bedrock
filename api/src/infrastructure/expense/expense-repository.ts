import { Expense } from "@/domain/expense/expense"
import { ExpenseApproval } from "@/domain/expense/expense-approval"
import type { Context } from "@/env"
import { expenseApprovals, expenses } from "@/schema"
import { eq } from "drizzle-orm"

export class ExpenseRepository {
  constructor(private readonly c: Context) {}

  async findById(expenseId: number): Promise<Expense | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(expenses)
        .where(eq(expenses.id, expenseId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Expense.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load expense")
    }
  }

  async create(expense: Expense): Promise<Expense | Error> {
    try {
      const rows = await this.c.var.database
        .insert(expenses)
        .values({
          employeeId: expense.employeeId,
          category: expense.category,
          amount: expense.amount,
          spentAt: expense.spentAt,
          note: expense.note,
          status: expense.status,
          createdAt: expense.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert expense") : Expense.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert expense")
    }
  }

  async update(expense: Expense): Promise<Expense | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(expenses)
        .set({ status: expense.status })
        .where(eq(expenses.id, expense.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Expense.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update expense")
    }
  }

  // 承認/却下の記録は経費集約に属するため、経費リポジトリが永続化する。
  async addApproval(approval: ExpenseApproval): Promise<ExpenseApproval | Error> {
    try {
      const rows = await this.c.var.database
        .insert(expenseApprovals)
        .values({
          expenseId: approval.expenseId,
          approverId: approval.approverId,
          action: approval.action,
          comment: approval.comment,
          createdAt: approval.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert expense approval")
        : ExpenseApproval.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert expense approval")
    }
  }
}
