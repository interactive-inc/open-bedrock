import { ThanksPointBudget } from "@/domain/thanks-points/thanks-point-budget"
import { monthlyBudgetPoints } from "@/domain/thanks-points/monthly-budget-points"
import type { Context } from "@/env"
import { thanks, thanksPointBudgets } from "@/schema"
import { and, eq } from "drizzle-orm"

export class ThanksPointBudgetRepository {
  constructor(private readonly c: Context) {}

  // 当月 period の原資レコードを取得する。無ければ null。
  async find(props: {
    employeeId: number
    period: string
  }): Promise<ThanksPointBudget | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(thanksPointBudgets)
        .where(
          and(
            eq(thanksPointBudgets.employeeId, props.employeeId),
            eq(thanksPointBudgets.period, props.period),
          ),
        )
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ThanksPointBudget.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load thanks point budget")
    }
  }

  // 当月 period の原資を取得し、無ければ既定額で遅延生成する（月初バッチに依存しない）。
  // 一意制約により同時生成は片方が衝突するため、衝突時は再取得でフォールバックする。
  async findOrCreate(props: {
    employeeId: number
    period: string
    createdAt: string
  }): Promise<ThanksPointBudget | Error> {
    const existing = await this.find({ employeeId: props.employeeId, period: props.period })

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return existing
    }

    const created = ThanksPointBudget.create({
      employeeId: props.employeeId,
      period: props.period,
      grantedPoints: monthlyBudgetPoints,
      createdAt: props.createdAt,
    })

    try {
      const rows = await this.c.var.database
        .insert(thanksPointBudgets)
        .values({
          employeeId: created.employeeId,
          period: created.period,
          grantedPoints: created.grantedPoints,
          createdAt: created.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert thanks point budget")
        : ThanksPointBudget.fromRow(row)
    } catch {
      const refetched = await this.find({ employeeId: props.employeeId, period: props.period })

      if (refetched instanceof Error) {
        return refetched
      }

      return refetched === null ? new Error("failed to insert thanks point budget") : refetched
    }
  }

  // 当月 period に贈与済みのポイント合計（送り手 = employeeId）を算出する。
  async getGrantedThisMonth(props: {
    employeeId: number
    period: string
  }): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ points: thanks.points, createdAt: thanks.createdAt })
        .from(thanks)
        .where(eq(thanks.senderEmployeeId, props.employeeId))

      const total = rows
        .filter((row) => row.createdAt.slice(0, 7) === props.period)
        .reduce((sum, row) => sum + row.points, 0)

      return total
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to sum granted points")
    }
  }
}
