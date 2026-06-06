import { periodOf } from "@/domain/thanks-points/period-of"
import { remainingBudgetPoints } from "@/domain/thanks-points/remaining-budget-points"
import type { Context } from "@/env"
import { ThanksPointBudgetRepository } from "@/infrastructure/thanks-points/thanks-point-budget-repository"

export type BudgetView = {
  period: string
  grantedPoints: number
  grantedThisMonth: number
  remainingPoints: number
}

// 当月の贈与原資（付与・贈与済み・残量）を参照する。budget が無ければ既定額で遅延生成する。
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

    const grantedThisMonth = await budgetRepository.getGrantedThisMonth({
      employeeId: props.employeeId,
      period,
    })

    if (grantedThisMonth instanceof Error) {
      return grantedThisMonth
    }

    return {
      period,
      grantedPoints: budget.grantedPoints,
      grantedThisMonth,
      remainingPoints: remainingBudgetPoints({
        grantedPoints: budget.grantedPoints,
        grantedThisMonth,
      }),
    }
  }
}
