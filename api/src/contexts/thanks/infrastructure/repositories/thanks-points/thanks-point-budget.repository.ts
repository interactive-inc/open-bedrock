import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { ThanksPointBudget } from "@/contexts/thanks/domain/entities/thanks-point-budget.entity"
import { monthlyBudgetPoints } from "@/contexts/thanks/domain/catalogs/thanks-point-limit.catalog"
import type { Context } from "@/env"
import { thanksPointBudgets } from "@/contexts/thanks/infrastructure/schema/thanks"
import { and, eq, gt, sql } from "drizzle-orm"

/** 原資消費の結果。consumed=消費を予約できた / insufficient=残量不足で予約できなかった。 */
export type ConsumeOutcome = "consumed" | "insufficient"

export class ThanksPointBudgetRepository {
  constructor(private readonly c: Context) {}

  /** 当月 period の原資レコードを取得する。無ければ null。 */
  async find(props: {
    employeeId: EmployeeId
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

  /**
   * 当月 period の原資を取得し、無ければ既定額で遅延生成する（月初バッチに依存しない）。
   * 一意制約により同時生成は片方が衝突するため、衝突時は再取得でフォールバックする。
   */
  async findOrCreate(props: {
    employeeId: EmployeeId
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
          consumedPoints: created.consumedPoints,
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

  /**
   * 原資の消費を 1 ステートメントで原子的に予約する。
   * granted_points − consumed_points >= points のときだけ consumed_points を加算する。
   * D1 は個々のステートメントを直列化するため、同月の同時送付でも合計が原資を超える分は必ず弾かれる。
   * 0 行更新は残量不足。points<=0 は呼び出し側で除外する前提（消費不要）。
   */
  async consume(props: {
    employeeId: EmployeeId
    period: string
    points: number
  }): Promise<ConsumeOutcome | Error> {
    try {
      const rows = await this.c.var.database
        .update(thanksPointBudgets)
        .set({ consumedPoints: sql`${thanksPointBudgets.consumedPoints} + ${props.points}` })
        .where(
          and(
            eq(thanksPointBudgets.employeeId, props.employeeId),
            eq(thanksPointBudgets.period, props.period),
            gt(
              sql`${thanksPointBudgets.grantedPoints} - ${thanksPointBudgets.consumedPoints}`,
              props.points - 1,
            ),
          ),
        )
        .returning()

      return rows.at(0) === undefined ? "insufficient" : "consumed"
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to consume thanks point budget")
    }
  }

  /** consume の補償。感謝の保存が失敗したときに予約した消費を戻す（下限 0 に丸める）。 */
  async release(props: {
    employeeId: EmployeeId
    period: string
    points: number
  }): Promise<null | Error> {
    try {
      await this.c.var.database
        .update(thanksPointBudgets)
        .set({
          consumedPoints: sql`MAX(${thanksPointBudgets.consumedPoints} - ${props.points}, 0)`,
        })
        .where(
          and(
            eq(thanksPointBudgets.employeeId, props.employeeId),
            eq(thanksPointBudgets.period, props.period),
          ),
        )

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to release thanks point budget")
    }
  }
}
