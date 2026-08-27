import { Budget } from "@/contexts/expense/domain/entities/budget.entity"
import type { Context } from "@/env"
import { budgets } from "@/contexts/expense/infrastructure/schema/budget"
import { expenses } from "@/contexts/expense/infrastructure/schema/expense"
import { and, asc, eq, gte, lte, sum } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type BudgetListFilter = {
  organizationUnitId: OrganizationUnitId | null
  fiscalPeriod: string | null
}

export class BudgetRepository {
  constructor(private readonly c: Context) {}

  async findById(budgetId: number): Promise<Budget | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(budgets)
        .where(eq(budgets.id, budgetId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Budget.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load budget")
    }
  }

  async list(filter: BudgetListFilter): Promise<ReadonlyArray<Budget> | Error> {
    try {
      const conditions: Array<SQL> = []

      if (filter.organizationUnitId !== null) {
        conditions.push(eq(budgets.organizationUnitId, filter.organizationUnitId))
      }

      if (filter.fiscalPeriod !== null) {
        conditions.push(eq(budgets.fiscalPeriod, filter.fiscalPeriod))
      }

      const where = conditions.length === 0 ? undefined : and(...conditions)

      const rows = await this.c.var.database
        .select()
        .from(budgets)
        .where(where)
        .orderBy(asc(budgets.organizationUnitId), asc(budgets.fiscalPeriod))

      return rows.map((row) => Budget.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to list budgets")
    }
  }

  async create(budget: Budget): Promise<Budget | Error> {
    try {
      const rows = await this.c.var.database
        .insert(budgets)
        .values({
          organizationUnitId: budget.organizationUnitId,
          fiscalPeriod: budget.fiscalPeriod,
          periodStart: budget.periodStart,
          periodEnd: budget.periodEnd,
          amount: budget.amount,
          name: budget.name,
          note: budget.note,
          createdAt: budget.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert budget") : Budget.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert budget")
    }
  }

  async update(budget: Budget): Promise<Budget | null | Error> {
    try {
      if (budget.id === null) {
        return new Error("cannot update unsaved budget")
      }

      const rows = await this.c.var.database
        .update(budgets)
        .set({
          amount: budget.amount,
          name: budget.name,
          note: budget.note,
        })
        .where(eq(budgets.id, budget.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Budget.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update budget")
    }
  }

  async delete(budgetId: number): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(budgets)
        .where(eq(budgets.id, budgetId))
        .returning({ id: budgets.id })

      return rows.length > 0 ? true : null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete budget")
    }
  }

  /**
   * 承認済み経費を部署・期間で SUM する。経費に部署の紐付きは無いため、申請者従業員の所属部署で集計する。
   * spent_at が予算の period_start..period_end に収まる approved の経費のみ対象。
   */
  async sumApprovedExpenses(props: {
    organizationUnitId: OrganizationUnitId
    periodStart: string
    periodEnd: string
  }): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: sum(expenses.amount) })
        .from(expenses)
        .where(
          and(
            eq(expenses.organizationUnitId, props.organizationUnitId),
            eq(expenses.status, "approved"),
            gte(expenses.spentAt, props.periodStart),
            lte(expenses.spentAt, props.periodEnd),
          ),
        )

      const total = rows.at(0)?.total

      return total === null || total === undefined ? 0 : Number(total)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to sum approved expenses")
    }
  }
}
