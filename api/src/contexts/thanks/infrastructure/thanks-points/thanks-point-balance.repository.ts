import type { Context } from "@/env"
import { thanks, thanksRedemptions } from "@/contexts/thanks/infrastructure/schema/thanks"
import { sql } from "drizzle-orm"

/**
 * 受領残高（もらった点数の累積）を読む。当月原資（送れる枠）とは別概念であり、
 * `thanks_point_budgets` は一切参照しない。
 *
 * 残高列は持たず `thanks_messages` の受領分から確定・未決裁の交換を引いて都度集計する。
 * 集計を選ぶのは、残高を列で二重に持つと台帳と食い違ったときに復元できないため。
 * 未決裁（pending）も引くのは、引当済みの点数を決裁前に二重に使えないようにするため。
 *
 * 同じ式は `ThanksRedemptionRepository` の申請・承認の防御にも埋め込まれており、
 * そちらは同時実行下で残高を割らせないために SQL 内で原子的に評価する必要がある。
 * 式を変えるときは両方を必ず揃える。
 */
export class ThanksPointBalanceRepository {
  constructor(private readonly c: Context) {}

  /**
   * 受領点数の合計 − 確定・未決裁の交換コストの合計。
   * 受領側と交換側を別クエリで読むと、その間に入った交換が数え漏れて残高が過大に見える。
   * 単一ステートメントに畳み込み、常に同一時点の値から算出する。
   */
  async getBalance(employeeId: number): Promise<number | Error> {
    try {
      const [row] = await this.c.var.database
        .select({
          balance: sql<number>`
            (SELECT COALESCE(SUM(${thanks.points}), 0) FROM ${thanks}
              WHERE ${thanks.recipientEmployeeId} = ${employeeId})
            - (SELECT COALESCE(SUM(${thanksRedemptions.pointCost}), 0) FROM ${thanksRedemptions}
              WHERE ${thanksRedemptions.employeeId} = ${employeeId}
                AND ${thanksRedemptions.status} IN ('fulfilled', 'pending'))
          `,
        })
        .from(sql`(SELECT 1)`)

      return row?.balance ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to compute balance")
    }
  }
}
