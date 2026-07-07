import { Budget } from "@/domain/budget/budget.entity"
import { BudgetConsumption } from "@/domain/budget/budget-consumption.entity"
import type { Context } from "@/env"
import { budgets, budgetConsumptions } from "@/schema"
import { and, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export class BudgetRepository {
  constructor(private readonly c: Context) {}

  // 会計年度の新しい順で予算枠を返す。fiscal_year / department_code で絞り込める。
  async findAll(props: {
    fiscalYear: number | null
    departmentCode: string | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<Budget> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(budgets)
        .where(toWhere(props.fiscalYear, props.departmentCode))
        .orderBy(desc(budgets.fiscalYear))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => Budget.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load budgets")
    }
  }

  async count(fiscalYear: number | null, departmentCode: string | null): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(budgets)
        .where(toWhere(fiscalYear, departmentCode))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count budgets")
    }
  }

  async findById(id: number): Promise<Budget | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(budgets)
        .where(eq(budgets.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Budget.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load budget")
    }
  }

  // 予算枠ごとの消化合計。会計計算ではなく amount からの単純減算のための集計。
  async sumConsumedByBudgetIds(
    budgetIds: ReadonlyArray<number>,
  ): Promise<Map<number, number> | Error> {
    try {
      const consumedByBudgetId = new Map<number, number>()

      if (budgetIds.length === 0) {
        return consumedByBudgetId
      }

      const rows = await this.c.var.database.select().from(budgetConsumptions)

      for (const row of rows) {
        if (budgetIds.includes(row.budgetId) === false) {
          continue
        }

        const current = consumedByBudgetId.get(row.budgetId) ?? 0

        consumedByBudgetId.set(row.budgetId, current + row.amount)
      }

      return consumedByBudgetId
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to sum budget consumptions")
    }
  }

  async create(budget: Budget): Promise<Budget | Error> {
    try {
      const rows = await this.c.var.database
        .insert(budgets)
        .values({
          fiscalYear: budget.fiscalYear,
          departmentCode: budget.departmentCode,
          title: budget.title,
          amount: budget.amount,
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
          fiscalYear: budget.fiscalYear,
          departmentCode: budget.departmentCode,
          title: budget.title,
          amount: budget.amount,
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

  async createConsumption(consumption: BudgetConsumption): Promise<BudgetConsumption | Error> {
    try {
      const rows = await this.c.var.database
        .insert(budgetConsumptions)
        .values({
          budgetId: consumption.budgetId,
          amount: consumption.amount,
          note: consumption.note,
          recordedOn: consumption.recordedOn,
          createdAt: consumption.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert budget_consumption")
        : BudgetConsumption.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert budget_consumption")
    }
  }
}

/** fiscal_year / department_code の絞り込み条件を組み立てる。未指定は全件。 */
function toWhere(fiscalYear: number | null, departmentCode: string | null): SQL | undefined {
  const conditions: Array<SQL> = []

  if (fiscalYear !== null) {
    conditions.push(eq(budgets.fiscalYear, fiscalYear))
  }

  if (departmentCode !== null) {
    conditions.push(eq(budgets.departmentCode, departmentCode))
  }

  return conditions.length === 0 ? undefined : and(...conditions)
}
