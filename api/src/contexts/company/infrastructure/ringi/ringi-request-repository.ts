import { RingiRequest } from "@/contexts/company/domain/ringi/ringi-request.entity"
import type { Context } from "@/env"
import { ringiRequests } from "@/schema"
import { and, eq } from "drizzle-orm"

export class RingiRequestRepository {
  constructor(private readonly c: Context) {}

  async findById(ringiId: number): Promise<RingiRequest | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(ringiRequests)
        .where(eq(ringiRequests.id, ringiId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : RingiRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load ringi request")
    }
  }

  async create(ringi: RingiRequest): Promise<RingiRequest | Error> {
    try {
      const rows = await this.c.var.database
        .insert(ringiRequests)
        .values({
          applicantId: ringi.applicantId,
          approverId: ringi.approverId,
          title: ringi.title,
          amount: ringi.amount,
          reason: ringi.reason,
          status: ringi.status,
          decidedAt: ringi.decidedAt,
          decisionComment: ringi.decisionComment,
          createdAt: ringi.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert ringi request")
        : RingiRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert ringi request")
    }
  }

  /**
   * 承認/却下を pending からの条件付き UPDATE で確定する。決定済みは 0 行更新となり null を返す。
   * 二重決定を防ぐ冪等性ガード（TOCTOU 競合にも強い）。決裁結果は行に inline 保持する。
   */
  async decideFromPending(props: {
    ringiId: number
    status: "approved" | "rejected"
    decidedAt: string
    decisionComment: string | null
  }): Promise<RingiRequest | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(ringiRequests)
        .set({
          status: props.status,
          decidedAt: props.decidedAt,
          decisionComment: props.decisionComment,
        })
        .where(and(eq(ringiRequests.id, props.ringiId), eq(ringiRequests.status, "pending")))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : RingiRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to decide ringi request")
    }
  }
}
