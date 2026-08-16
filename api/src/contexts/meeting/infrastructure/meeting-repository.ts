import { Meeting } from "@/contexts/meeting/domain/meeting.entity"
import type { Context } from "@/env"
import { meetings } from "@/contexts/meeting/infrastructure/schema/meeting"
import { eq } from "drizzle-orm"

export class MeetingRepository {
  constructor(private readonly c: Context) {}

  /** 会議体 code で1件取得する。存在しなければ null。 */
  async findByCode(code: string): Promise<Meeting | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(meetings)
        .where(eq(meetings.code, code))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Meeting.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load meeting")
    }
  }

  async create(meeting: Meeting): Promise<Meeting | Error> {
    try {
      const rows = await this.c.var.database
        .insert(meetings)
        .values({
          code: meeting.code,
          name: meeting.name,
          cadence: meeting.cadence,
          description: meeting.description,
          status: meeting.status,
          createdAt: meeting.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert meeting") : Meeting.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert meeting")
    }
  }

  /** 会議体の名称・頻度・説明・状態を更新する。該当行が無ければ null。 */
  async update(meeting: Meeting): Promise<Meeting | null | Error> {
    try {
      if (meeting.id === null) {
        return new Error("cannot update unsaved meeting")
      }

      const rows = await this.c.var.database
        .update(meetings)
        .set({
          name: meeting.name,
          cadence: meeting.cadence,
          description: meeting.description,
          status: meeting.status,
        })
        .where(eq(meetings.id, meeting.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Meeting.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update meeting")
    }
  }
}
