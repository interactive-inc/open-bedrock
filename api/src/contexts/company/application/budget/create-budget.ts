import { Budget } from "@/contexts/company/domain/budget/budget.entity"
import type { Context } from "@/env"
import { BudgetRepository } from "@/contexts/company/infrastructure/budget/budget-repository"
import { NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { departments } from "@/schema"
import { eq } from "drizzle-orm"

export type Command = {
  departmentId: number
  fiscalPeriod: string
  periodStart: string
  periodEnd: string
  amount: number
  name: string
  note: string | null
  createdAt: string
}

/**
 * 部署予算を登録する。対象部署の実在と期間の前後関係を検証する
 */
export class CreateBudget {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Budget | ApplicationError> {
    if (command.periodEnd < command.periodStart) {
      return new ValidationError("period_end must not precede period_start", "invalid_period")
    }

    const departmentRows = await this.c.var.database
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, command.departmentId))
      .limit(1)

    if (departmentRows.at(0) === undefined) {
      return new NotFoundError("department not found", "department_not_found")
    }

    const repository = new BudgetRepository(this.c)

    const budget = Budget.create({
      departmentId: command.departmentId,
      fiscalPeriod: command.fiscalPeriod,
      periodStart: command.periodStart,
      periodEnd: command.periodEnd,
      amount: command.amount,
      name: command.name,
      note: command.note,
      createdAt: command.createdAt,
    })

    const created = await repository.create(budget)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create budget", { cause: created })
    }

    return created
  }
}
