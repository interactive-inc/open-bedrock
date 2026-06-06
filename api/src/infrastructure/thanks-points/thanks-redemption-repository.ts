import { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption"
import type { Context } from "@/env"
import { thanks, thanksRedemptions } from "@/schema"
import { and, desc, eq, inArray } from "drizzle-orm"

// 残高から差し引く対象とみなす確定済みの交換ステータス。
// approved と fulfilled をどちらも消費済みとして扱い、pending / rejected は残高に影響させない。
const settledStatuses: ReadonlyArray<"approved" | "fulfilled"> = ["approved", "fulfilled"]

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

  // pending からの遷移だけを許す条件付き UPDATE で承認/却下を確定する。
  // WHERE に status='pending' を含めることで、同時 2 件の承認が来ても 1 件しか更新されず
  // 二重承認＝二重消費を原子的に弾く（TOCTOU 対策。#45 の二重発行と同型）。
  // 0 行更新（既に決裁済み）は null を返す。
  async decideFromPending(redemption: ThanksRedemption): Promise<ThanksRedemption | null | Error> {
    try {
      if (redemption.id === null) {
        return new Error("cannot decide unsaved redemption")
      }

      const rows = await this.c.var.database
        .update(thanksRedemptions)
        .set({
          status: redemption.status,
          decidedAt: redemption.decidedAt,
          deciderId: redemption.deciderId,
        })
        .where(
          and(eq(thanksRedemptions.id, redemption.id), eq(thanksRedemptions.status, "pending")),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ThanksRedemption.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to decide thanks redemption")
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

  // 受領残高を算出する。受領 thanks.points 合計 − 確定交換 point_cost 合計。
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
            inArray(thanksRedemptions.status, settledStatuses),
          ),
        )

      const settled = settledRows.reduce((sum, row) => sum + row.pointCost, 0)

      return received - settled
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to compute balance")
    }
  }
}
