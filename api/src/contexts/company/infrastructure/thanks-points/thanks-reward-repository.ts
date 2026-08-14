import { ThanksReward } from "@/contexts/company/domain/thanks-points/thanks-reward.entity"
import type { Context } from "@/env"
import { thanksRewards } from "@/schema"
import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm"

/** 在庫減算の結果。在庫を 1 減らせた / 無制限 / 在庫切れ / 失敗 を区別する。 */
export type StockDecrementOutcome = "decremented" | "unlimited" | "out_of_stock"

export class ThanksRewardRepository {
  constructor(private readonly c: Context) {}

  async findById(rewardId: number): Promise<ThanksReward | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(thanksRewards)
        .where(eq(thanksRewards.id, rewardId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ThanksReward.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load thanks reward")
    }
  }

  /** カタログ一覧を新しい順で取得する。activeOnly=true なら有効なものだけ。 */
  async findMany(props: {
    activeOnly: boolean
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ThanksReward> | Error> {
    try {
      const base = this.c.var.database.select().from(thanksRewards)

      const rows = props.activeOnly
        ? await base
            .where(eq(thanksRewards.isActive, true))
            .orderBy(desc(thanksRewards.id))
            .limit(props.limit)
            .offset(props.offset)
        : await base.orderBy(desc(thanksRewards.id)).limit(props.limit).offset(props.offset)

      return rows.map((row) => ThanksReward.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load thanks rewards")
    }
  }

  async create(reward: ThanksReward): Promise<ThanksReward | Error> {
    try {
      const rows = await this.c.var.database
        .insert(thanksRewards)
        .values({
          name: reward.name,
          pointCost: reward.pointCost,
          isActive: reward.isActive,
          stock: reward.stock,
          createdAt: reward.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert thanks reward")
        : ThanksReward.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert thanks reward")
    }
  }

  async update(reward: ThanksReward): Promise<ThanksReward | null | Error> {
    try {
      if (reward.id === null) {
        return new Error("cannot update unsaved reward")
      }

      const rows = await this.c.var.database
        .update(thanksRewards)
        .set({
          name: reward.name,
          pointCost: reward.pointCost,
          isActive: reward.isActive,
          stock: reward.stock,
        })
        .where(eq(thanksRewards.id, reward.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ThanksReward.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update thanks_messages reward")
    }
  }

  /**
   * stock 以外のメタ情報(名前・コスト・有効状態)だけを更新する。
   * 在庫は decrementStock() で原子的に操作するため、管理画面からの上書きを避けて lost update を防ぐ。
   */
  async updateWithoutStock(reward: ThanksReward): Promise<ThanksReward | null | Error> {
    try {
      if (reward.id === null) {
        return new Error("cannot update unsaved reward")
      }

      const rows = await this.c.var.database
        .update(thanksRewards)
        .set({
          name: reward.name,
          pointCost: reward.pointCost,
          isActive: reward.isActive,
        })
        .where(eq(thanksRewards.id, reward.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ThanksReward.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update thanks_messages reward")
    }
  }

  /**
   * 在庫を 1 だけ原子的に減らす。stock IS NOT NULL AND stock>0 のときだけ更新するため
   * 同時承認でも在庫はマイナスにならない。無制限（stock=null）と在庫切れを区別して返す。
   * SQL 例外は Error として返し、握りつぶさず呼び出し側で追跡できるようにする。
   */
  async decrementStock(rewardId: number): Promise<StockDecrementOutcome | Error> {
    try {
      const rows = await this.c.var.database
        .update(thanksRewards)
        .set({ stock: sql`${thanksRewards.stock} - 1` })
        .where(
          and(
            eq(thanksRewards.id, rewardId),
            isNotNull(thanksRewards.stock),
            gt(thanksRewards.stock, 0),
          ),
        )
        .returning()

      if (rows.at(0) !== undefined) {
        return "decremented"
      }

      const reward = await this.findById(rewardId)

      if (reward instanceof Error) {
        return reward
      }

      if (reward === null) {
        return new Error("thanks reward not found")
      }

      return reward.stock === null ? "unlimited" : "out_of_stock"
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to decrement reward stock")
    }
  }
}
