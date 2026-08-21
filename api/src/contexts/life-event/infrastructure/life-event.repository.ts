import { LifeEvent } from "@/contexts/life-event/domain/entities/life-event.entity"
import type { Context } from "@/env"
import { lifeEvents } from "@/contexts/life-event/infrastructure/schema/life-event"
import { and, asc, eq } from "drizzle-orm"

export class LifeEventRepository {
  constructor(private readonly c: Context) {}

  /** 届出者本人のライフイベント届出をイベント日の昇順でページングして返す。 */
  async findByEmployeeId(props: {
    employeeId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<LifeEvent> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(lifeEvents)
        .where(eq(lifeEvents.employeeId, props.employeeId))
        .orderBy(asc(lifeEvents.eventDate))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => LifeEvent.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load life_events")
    }
  }

  /** ライフイベント届出 id で1件取得する。存在しなければ null。 */
  async findById(id: string): Promise<LifeEvent | null | Error> {
    try {
      const rows = await this.c.var.database.select().from(lifeEvents).where(eq(lifeEvents.id, id))

      const row = rows.at(0)

      return row === undefined ? null : LifeEvent.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load life_event")
    }
  }

  async create(lifeEvent: LifeEvent): Promise<LifeEvent | Error> {
    try {
      await this.c.var.database.insert(lifeEvents).values({
        id: lifeEvent.id,
        employeeId: lifeEvent.employeeId,
        eventType: lifeEvent.eventType,
        eventDate: lifeEvent.eventDate,
        detail: lifeEvent.detail,
        status: lifeEvent.status,
        createdAt: lifeEvent.createdAt,
      })

      return lifeEvent
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save life_event")
    }
  }

  /** ライフイベント届出の種別・発生日・詳細を更新する。status が "submitted" の行のみ対象。 */
  async update(lifeEvent: LifeEvent): Promise<LifeEvent | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(lifeEvents)
        .set({
          eventType: lifeEvent.eventType,
          eventDate: lifeEvent.eventDate,
          detail: lifeEvent.detail,
        })
        .where(and(eq(lifeEvents.id, lifeEvent.id), eq(lifeEvents.status, "submitted")))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : LifeEvent.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update life_event")
    }
  }

  /** status を fromStatus から toStatus へ遷移する。行が fromStatus でなければ 0 行更新となり null を返す。 */
  async updateStatus(props: {
    id: string
    fromStatus: string
    toStatus: string
  }): Promise<LifeEvent | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(lifeEvents)
        .set({ status: props.toStatus })
        .where(and(eq(lifeEvents.id, props.id), eq(lifeEvents.status, props.fromStatus)))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : LifeEvent.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update life_event status")
    }
  }

  /** ライフイベント届出を削除する。status が "submitted" の行のみ対象。 */
  async delete(id: string): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(lifeEvents)
        .where(and(eq(lifeEvents.id, id), eq(lifeEvents.status, "submitted")))
        .returning({ id: lifeEvents.id })

      return rows.length > 0 ? true : null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete life_event")
    }
  }
}
