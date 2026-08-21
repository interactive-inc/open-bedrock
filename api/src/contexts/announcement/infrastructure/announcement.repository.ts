import { Announcement } from "@/contexts/announcement/domain/announcement.entity"
import type { Context } from "@/env"
import { announcements } from "@/contexts/announcement/infrastructure/schema/announcement"
import { eq } from "drizzle-orm"

export class AnnouncementRepository {
  constructor(private readonly c: Context) {}

  async findById(id: number): Promise<Announcement | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(announcements)
        .where(eq(announcements.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Announcement.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load announcement")
    }
  }

  async create(announcement: Announcement): Promise<Announcement | Error> {
    try {
      const rows = await this.c.var.database
        .insert(announcements)
        .values({
          title: announcement.title,
          bodyMd: announcement.bodyMd,
          publishedOn: announcement.publishedOn,
          authorEmployeeId: announcement.authorEmployeeId,
          status: announcement.status,
          createdAt: announcement.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert announcement")
        : Announcement.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert announcement")
    }
  }

  async update(announcement: Announcement): Promise<Announcement | null | Error> {
    try {
      if (announcement.id === null) {
        return new Error("cannot update unsaved announcement")
      }

      const rows = await this.c.var.database
        .update(announcements)
        .set({
          title: announcement.title,
          bodyMd: announcement.bodyMd,
          publishedOn: announcement.publishedOn,
          status: announcement.status,
        })
        .where(eq(announcements.id, announcement.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Announcement.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update announcement")
    }
  }
}
