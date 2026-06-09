import { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption"
import type { Context } from "@/env"
import { thanks, thanksRedemptions } from "@/schema"
import { and, desc, eq, sql } from "drizzle-orm"

// 残高から差し引く対象とみなす確定済みの交換ステータス。確定は fulfilled の1つだけ。
// 承認＝確定（fulfilled）へ直行するため approved は使わない。
// この集合は getBalance の集計と approveFromPending の残高サブクエリの両方で一致させる。
const settledStatus = "fulfilled"

export class ThanksRedemptionRepository {
  constructor(private readonly c: Context) {}

  async findById(redemptionId: number): Promise<ThanksRedemption | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(thanksRedemptions)
        .where(eq(thanksRedemptions.id, redemptionId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ThanksRedemption.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load thanks redemption")
    }
  }

  async create(redemption: ThanksRedemption): Promise<ThanksRedemption | Error> {
    try {
      const rows = await this.c.var.database
        .insert(thanksRedemptions)
        .values({
          employeeId: redemption.employeeId,
          rewardId: redemption.rewardId,
          pointCost: redemption.pointCost,
          status: redemption.status,
          createdAt: redemption.createdAt,
          decidedAt: redemption.decidedAt,
          deciderId: redemption.deciderId,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert thanks redemption")
        : ThanksRedemption.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert thanks redemption")
    }
  }

  // 承認＝確定を 1 ステートメントで原子的に行う。残高チェックを確定 UPDATE の WHERE に畳み込み、
  // 「pending かつ 当該社員の確定残高 >= point_cost」のときだけ fulfilled へ更新する。
  // D1 は個々のステートメントを直列化するため、別 ID の同時承認でも合計が残高を超える分は必ず弾かれる
  // （残高がマイナスに割れない）。0 行更新は残高不足 or 既に決裁済みを意味する。
  async approveFromPending(props: {
    redemptionId: number
    employeeId: number
    deciderId: number
    decidedAt: string
  }): Promise<ThanksRedemption | null | Error> {
    try {
      const balanceExpression = sql`(
        (SELECT COALESCE(SUM(${thanks.points}), 0) FROM ${thanks}
          WHERE ${thanks.recipientEmployeeId} = ${props.employeeId})
        - (SELECT COALESCE(SUM(${thanksRedemptions.pointCost}), 0) FROM ${thanksRedemptions}
          WHERE ${thanksRedemptions.employeeId} = ${props.employeeId}
            AND ${thanksRedemptions.status} = ${settledStatus})
      ) >= ${thanksRedemptions.pointCost}`

      const rows = await this.c.var.database
        .update(thanksRedemptions)
        .set({ status: "fulfilled", decidedAt: props.decidedAt, deciderId: props.deciderId })
        .where(
          and(
            eq(thanksRedemptions.id, props.redemptionId),
            eq(thanksRedemptions.status, "pending"),
            balanceExpression,
          ),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ThanksRedemption.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to approve thanks redemption")
    }
  }

  // 却下を pending からの条件付き UPDATE で原子的に行う。0 行更新は既に決裁済み。
  async rejectFromPending(props: {
    redemptionId: number
    deciderId: number
    decidedAt: string
  }): Promise<ThanksRedemption | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(thanksRedemptions)
        .set({ status: "rejected", decidedAt: props.decidedAt, deciderId: props.deciderId })
        .where(
          and(
            eq(thanksRedemptions.id, props.redemptionId),
            eq(thanksRedemptions.status, "pending"),
          ),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ThanksRedemption.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to reject thanks redemption")
    }
  }

  async findByEmployee(employeeId: number): Promise<ReadonlyArray<ThanksRedemption> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(thanksRedemptions)
        .where(eq(thanksRedemptions.employeeId, employeeId))
        .orderBy(desc(thanksRedemptions.id))

      return rows.map((row) => ThanksRedemption.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load redemptions")
    }
  }

  async findPending(): Promise<ReadonlyArray<ThanksRedemption> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(thanksRedemptions)
        .where(eq(thanksRedemptions.status, "pending"))
        .orderBy(desc(thanksRedemptions.id))

      return rows.map((row) => ThanksRedemption.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load pending redemptions")
    }
  }

  // 指定社員に pending 状態の交換申請が存在するかを返す。
  async hasPendingByEmployee(employeeId: number): Promise<boolean | Error> {
    try {
      const rows = await this.c.var.database
        .select({ id: thanksRedemptions.id })
        .from(thanksRedemptions)
        .where(
          and(
            eq(thanksRedemptions.employeeId, employeeId),
            eq(thanksRedemptions.status, "pending"),
          ),
        )
        .limit(1)

      return rows.length > 0
    } catch (error) {
      return error instanceof Error
        ? error
        : new Error("failed to check pending redemptions")
    }
  }

  // 受領残高を算出する。受領 thanks.points 合計 − 確定交換（fulfilled）の point_cost 合計。
  // 残高列は持たず台帳から集計することで二重持ちによる不整合を避ける。
  async getBalance(employeeId: number): Promise<number | Error> {
    try {
      const receivedRows = await this.c.var.database
        .select({ points: thanks.points })
        .from(thanks)
        .where(eq(thanks.recipientEmployeeId, employeeId))

      const received = receivedRows.reduce((sum, row) => sum + row.points, 0)

      const settledRows = await this.c.var.database
        .select({ pointCost: thanksRedemptions.pointCost })
        .from(thanksRedemptions)
        .where(
          and(
            eq(thanksRedemptions.employeeId, employeeId),
            eq(thanksRedemptions.status, settledStatus),
          ),
        )

      const settled = settledRows.reduce((sum, row) => sum + row.pointCost, 0)

      return received - settled
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to compute balance")
    }
  }
}
