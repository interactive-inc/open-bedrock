import { MeetingMinutes } from "@/domain/meeting/meeting-minutes.entity"
import type { Context } from "@/env"
import { meetingMinutes } from "@/schema"
import { desc, eq } from "drizzle-orm"

export class MeetingMinutesRepository {
  constructor(private readonly c: Context) {}

  /** 議事録 id で1件取得する。存在しなければ null。 */
  async findById(id: number): Promise<MeetingMinutes | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(meetingMinutes)
        .where(eq(meetingMinutes.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : MeetingMinutes.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load meeting_minutes")
    }
  }

  /** 会議体 id 配下の議事録を新しい順に取得する。 */
  async listByMeetingId(
    meetingId: number,
    limit: number,
    offset: number,
  ): Promise<ReadonlyArray<MeetingMinutes> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(meetingMinutes)
        .where(eq(meetingMinutes.meetingId, meetingId))
        .orderBy(desc(meetingMinutes.heldOn), desc(meetingMinutes.id))
        .limit(limit)
        .offset(offset)

      return rows.map((row) => MeetingMinutes.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load meeting_minutes list")
    }
  }

  async create(minutes: MeetingMinutes): Promise<MeetingMinutes | Error> {
    try {
      const rows = await this.c.var.database
        .insert(meetingMinutes)
        .values({
          meetingId: minutes.meetingId,
          heldOn: minutes.heldOn,
          title: minutes.title,
          attendees: minutes.attendees,
          bodyMd: minutes.bodyMd,
          authorEmployeeId: minutes.authorEmployeeId,
          createdAt: minutes.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert meeting_minutes")
        : MeetingMinutes.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert meeting_minutes")
    }
  }

  /** 議事録の開催日・表題・出席者・本文を更新する。該当行が無ければ null。 */
  async update(minutes: MeetingMinutes): Promise<MeetingMinutes | null | Error> {
    try {
      if (minutes.id === null) {
        return new Error("cannot update unsaved meeting_minutes")
      }

      const rows = await this.c.var.database
        .update(meetingMinutes)
        .set({
          heldOn: minutes.heldOn,
          title: minutes.title,
          attendees: minutes.attendees,
          bodyMd: minutes.bodyMd,
        })
        .where(eq(meetingMinutes.id, minutes.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : MeetingMinutes.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update meeting_minutes")
    }
  }
}
