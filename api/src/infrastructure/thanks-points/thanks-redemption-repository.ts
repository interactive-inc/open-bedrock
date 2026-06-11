import { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption"
import type { Context } from "@/env"
import { thanks, thanksRedemptions, thanksRewards } from "@/schema"
import { and, desc, eq, inArray, sql } from "drizzle-orm"

// 確定済みの交換ステータス。確定は fulfilled の1つだけ。
// 承認＝確定（fulfilled）へ直行するため approved は使わない。
// getBalance と approveFromPending はともに fulfilled + pending を差し引いて残高を算出する。
const settledStatus = "fulfilled"

export type PendingExistsError = { reason: "pending_exists" }

export type InsufficientBalanceError = { reason: "insufficient_balance" }

export type OutOfStockError = { reason: "out_of_stock" }

export type RewardInactiveError = { reason: "reward_inactive" }

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

  async create(
    redemption: ThanksRedemption,
  ): Promise<ThanksRedemption | PendingExistsError | Error> {
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
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        return { reason: "pending_exists" }
      }
      return error instanceof Error ? error : new Error("failed to insert thanks redemption")
    }
  }

  // 残高チェック・重複 pending チェック・在庫チェックを INSERT の SELECT ... WHERE に畳み込んだ
  // 1 ステートメントでアトミックに申請を作成する。D1 は個々のステートメントを直列化するため、
  // 同時に複数の申請が試みられても残高がマイナスに割れず、在庫ゼロの報酬への申請も通らない。
  // 0 行挿入（changes === 0）は残高不足・既に pending が存在・在庫切れのいずれかを意味する。
  // 原因は hasPendingByEmployee と在庫の再 SELECT で判定する（INSERT が弾いた後なので競合の心配は不要）。
  async createIfSufficientBalance(
    redemption: ThanksRedemption,
  ): Promise<
    | ThanksRedemption
    | PendingExistsError
    | InsufficientBalanceError
    | OutOfStockError
    | RewardInactiveError
    | Error
  > {
    try {
      const result = await this.c.var.database.run(
        sql`INSERT INTO thanks_redemptions (employee_id, reward_id, point_cost, status, created_at, decided_at, decider_id)
            SELECT ${redemption.employeeId}, ${redemption.rewardId}, ${redemption.pointCost},
                   'pending', ${redemption.createdAt}, NULL, NULL
            WHERE (
              (SELECT COALESCE(SUM(${thanks.points}), 0) FROM ${thanks}
                WHERE ${thanks.recipientEmployeeId} = ${redemption.employeeId})
              - (SELECT COALESCE(SUM(${thanksRedemptions.pointCost}), 0) FROM ${thanksRedemptions}
                WHERE ${thanksRedemptions.employeeId} = ${redemption.employeeId}
                  AND ${thanksRedemptions.status} IN (${settledStatus}, 'pending'))
            ) >= ${redemption.pointCost}
            AND NOT EXISTS (
              SELECT 1 FROM ${thanksRedemptions}
              WHERE ${thanksRedemptions.employeeId} = ${redemption.employeeId}
                AND ${thanksRedemptions.status} = 'pending'
            )
            AND (
              (SELECT ${thanksRewards.stock} FROM ${thanksRewards}
                WHERE ${thanksRewards.id} = ${redemption.rewardId}) IS NULL
              OR (SELECT ${thanksRewards.stock} FROM ${thanksRewards}
                WHERE ${thanksRewards.id} = ${redemption.rewardId}) > 0
            )
            AND (SELECT ${thanksRewards.isActive} FROM ${thanksRewards}
              WHERE ${thanksRewards.id} = ${redemption.rewardId}) = 1`,
      )

      if (result.meta.changes === 0) {
        const hasPending = await this.hasPendingByEmployee(redemption.employeeId)

        if (hasPending instanceof Error) {
          return hasPending
        }

        if (hasPending) {
          return { reason: "pending_exists" }
        }

        // pending が無いのに 0 行なら、報酬非アクティブ・在庫切れ・残高不足のいずれか。
        // 報酬の状態を見て区別する。
        const rewardRows = await this.c.var.database
          .select({ stock: thanksRewards.stock, isActive: thanksRewards.isActive })
          .from(thanksRewards)
          .where(eq(thanksRewards.id, redemption.rewardId))
          .limit(1)

        const rewardRow = rewardRows.at(0)

        if (rewardRow !== undefined && !rewardRow.isActive) {
          return { reason: "reward_inactive" }
        }

        const stock = rewardRow?.stock ?? null

        if (stock !== null && stock <= 0) {
          return { reason: "out_of_stock" }
        }

        return { reason: "insufficient_balance" }
      }

      const lastId = result.meta.last_row_id

      const rows = await this.c.var.database
        .select()
        .from(thanksRedemptions)
        .where(eq(thanksRedemptions.id, lastId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to load inserted thanks redemption")
        : ThanksRedemption.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert thanks redemption")
    }
  }

  // 承認＝確定を 1 ステートメントで原子的に行う。残高チェックを確定 UPDATE の WHERE に畳み込み、
  // 「pending かつ 当該社員の残高（fulfilled + 他の pending を差し引き） >= point_cost」のときだけ
  // fulfilled へ更新する。自身の pending 行は差し引き対象から除外し二重カウントを防ぐ。
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
            AND ${thanksRedemptions.status} IN (${settledStatus}, 'pending')
            AND ${thanksRedemptions.id} != ${props.redemptionId})
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

  async findByEmployee(props: {
    employeeId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ThanksRedemption> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(thanksRedemptions)
        .where(eq(thanksRedemptions.employeeId, props.employeeId))
        .orderBy(desc(thanksRedemptions.id))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => ThanksRedemption.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load redemptions")
    }
  }

  async findPending(props: {
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ThanksRedemption> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(thanksRedemptions)
        .where(eq(thanksRedemptions.status, "pending"))
        .orderBy(desc(thanksRedemptions.id))
        .limit(props.limit)
        .offset(props.offset)

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
      return error instanceof Error ? error : new Error("failed to check pending redemptions")
    }
  }

  // 受領残高を算出する。受領 thanks.points 合計 − 確定・保留中の交換（fulfilled + pending）の
  // point_cost 合計。pending を含めることで、未決裁の申請分も残高に反映させる。
  // 残高列は持たず台帳から集計することで二重持ちによる不整合を避ける。
  async getBalance(employeeId: number): Promise<number | Error> {
    try {
      const [receivedRow] = await this.c.var.database
        .select({ total: sql<number>`COALESCE(SUM(${thanks.points}), 0)` })
        .from(thanks)
        .where(eq(thanks.recipientEmployeeId, employeeId))

      const [deductedRow] = await this.c.var.database
        .select({
          total: sql<number>`COALESCE(SUM(${thanksRedemptions.pointCost}), 0)`,
        })
        .from(thanksRedemptions)
        .where(
          and(
            eq(thanksRedemptions.employeeId, employeeId),
            inArray(thanksRedemptions.status, [settledStatus, "pending"]),
          ),
        )

      return (receivedRow?.total ?? 0) - (deductedRow?.total ?? 0)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to compute balance")
    }
  }
}
