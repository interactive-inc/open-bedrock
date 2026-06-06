import { periodOf } from "@/domain/thanks-points/period-of"
import type { Context } from "@/env"
import { ThanksPointBudgetRepository } from "@/infrastructure/thanks-points/thanks-point-budget-repository"

export type BudgetView = {
  period: string
  grantedPoints: number
  consumedPoints: number
  remainingPoints: number
}

// 当月の贈与原資（付与・消費・残量）を参照する。budget が無ければ既定額で遅延生成する。
export class ViewMyBudget {
  constructor(private readonly c: Context) {}

  async run(props: { employeeId: number; now: string }): Promise<BudgetView | Error> {
    const budgetRepository = new ThanksPointBudgetRepository(this.c)

    const period = periodOf(props.now)

    const budget = await budgetRepository.findOrCreate({
      employeeId: props.employeeId,
      period,
      createdAt: props.now,
    })

    if (budget instanceof Error) {
      return budget
    }

    return {
      period,
      grantedPoints: budget.grantedPoints,
      consumedPoints: budget.consumedPoints,
      remainingPoints: budget.remainingPoints,
    }
  }
}
