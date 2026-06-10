import { Expense } from "@/domain/expense/expense"
import { ExpenseApproval } from "@/domain/expense/expense-approval"
import type { Context } from "@/env"
import { expenseApprovals, expenses } from "@/schema"
import { and, eq } from "drizzle-orm"

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
      if (expense.id === null) {
        return new Error("cannot update unsaved expense")
      }

      const rows = await this.c.var.database
        .update(expenses)
        .set({
          category: expense.category,
          amount: expense.amount,
          spentAt: expense.spentAt,
          note: expense.note,
          status: expense.status,
        })
        .where(eq(expenses.id, expense.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Expense.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update expense")
    }
  }

  // 承認/却下を pending からの条件付き UPDATE で確定する。決定済みは 0 行更新となり null を返す。
  // 二重決定を防ぐ冪等性ガード（TOCTOU 競合にも強い）。
  async decideFromPending(props: {
    expenseId: number
    status: "approved" | "rejected"
  }): Promise<Expense | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(expenses)
        .set({ status: props.status })
        .where(and(eq(expenses.id, props.expenseId), eq(expenses.status, "pending")))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Expense.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to decide expense")
    }
  }

  // 経費申請を削除する。
  async delete(expenseId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(expenses).where(eq(expenses.id, expenseId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete expense")
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
