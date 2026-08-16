import { Decision } from "@/contexts/meeting/domain/decision/decision.entity"
import type { Context } from "@/env"
import { decisions } from "@/contexts/meeting/infrastructure/schema/meeting"
import { and, count, desc, eq } from "drizzle-orm"

export class DecisionRepository {
  constructor(private readonly c: Context) {}

  /** 決定 id で1件取得する。存在しなければ null。 */
  async findById(id: number): Promise<Decision | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(decisions)
        .where(eq(decisions.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Decision.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load decision")
    }
  }

  async list(limit: number, offset: number): Promise<ReadonlyArray<Decision> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(decisions)
        .orderBy(desc(decisions.decidedOn), desc(decisions.id))
        .limit(limit)
        .offset(offset)

      return rows.map((row) => Decision.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load decision list")
    }
  }

  async count(): Promise<number | Error> {
    try {
      const rows = await this.c.var.database.select({ total: count() }).from(decisions)

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count decisions")
    }
  }

  async create(decision: Decision): Promise<Decision | Error> {
    try {
      const rows = await this.c.var.database
        .insert(decisions)
        .values({
          title: decision.title,
          decidedOn: decision.decidedOn,
          context: decision.context,
          decision: decision.decision,
          consequences: decision.consequences,
          status: decision.status,
          supersededById: decision.supersededById,
          createdAt: decision.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert decision") : Decision.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert decision")
    }
  }

  /** 決定の表題・決定日・文脈・決定・帰結を更新する。該当行が無ければ null。 */
  async update(decision: Decision): Promise<Decision | null | Error> {
    try {
      if (decision.id === null) {
        return new Error("cannot update unsaved decision")
      }

      const rows = await this.c.var.database
        .update(decisions)
        .set({
          title: decision.title,
          decidedOn: decision.decidedOn,
          context: decision.context,
          decision: decision.decision,
          consequences: decision.consequences,
        })
        .where(eq(decisions.id, decision.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Decision.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update decision")
    }
  }

  /**
   * active な決定だけを条件付きで superseded に遷移させる（TOCTOU 防止）。
   * 更新された行を返す。既に superseded 等で対象外なら null。
   */
  async supersede(id: number, supersededById: number): Promise<Decision | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(decisions)
        .set({
          status: "superseded",
          supersededById: supersededById,
        })
        .where(and(eq(decisions.id, id), eq(decisions.status, "active")))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Decision.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to supersede decision")
    }
  }
}
