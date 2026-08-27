import { Budget } from "@/contexts/expense/domain/entities/budget.entity"
import type { Context } from "@/env"
import { BudgetRepository } from "@/contexts/expense/infrastructure/repositories/budget/budget.repository"
import { NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"

export type Command = {
  organizationUnitId: OrganizationUnitId
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
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Budget | ApplicationError> {
    if (command.periodEnd < command.periodStart) {
      return new ValidationError("period_end must not precede period_start", "invalid_period")
    }

    const snapshot = await new ReadCanonicalOrganizationStateAdapter(
      this.c,
    ).readCanonicalOrganizationState()
    if (snapshot instanceof Error) {
      return new UnexpectedError("failed to resolve organization unit", { cause: snapshot })
    }
    if (
      !snapshot.organization.units.some(
        (unit) => unit.organizationUnitId === command.organizationUnitId,
      )
    ) {
      return new NotFoundError("organization unit not found", "organization_unit_not_found")
    }

    const repository = new BudgetRepository(this.c)

    const budget = Budget.create({
      organizationUnitId: command.organizationUnitId,
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
