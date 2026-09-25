import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 会議体マスタ（定例会議などの器。cadence は開催頻度メモ） */
export const meetings = sqliteTable(
  "meetings",
  {
    id: text("id").primaryKey().notNull(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    cadence: text("cadence"),
    description: text("description"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("meetings_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_meetings_status").on(table.status),
  ],
)

export type MeetingRow = InferSelectModel<typeof meetings>

/** 議事録（会議体ごとの開催記録） */
export const meetingMinutes = sqliteTable(
  "meeting_minutes_records",
  {
    id: text("id").primaryKey().notNull(),
    meetingId: text("meeting_id").notNull(),
    heldOn: text("held_on").notNull(),
    title: text("title").notNull(),
    attendees: text("attendees"),
    bodyMd: text("body_md").notNull(),
    authorEmployeeId: text("author_employee_id").$type<EmployeeId>().notNull(),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("meeting_minutes_records_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_meeting_minutes_meeting").on(table.meetingId),
  ],
)

export type MeetingMinutesRow = InferSelectModel<typeof meetingMinutes>

/** 意思決定記録（ADR 形式。文脈・決定・帰結を記録し、後続の決定で supersede する） */
export const decisions = sqliteTable(
  "decision_records",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    decidedOn: text("decided_on").notNull(),
    context: text("context").notNull(),
    decision: text("decision").notNull(),
    consequences: text("consequences"),
    status: text("status").notNull(),
    supersededById: text("superseded_by_id"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("decision_records_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_decisions_status").on(table.status),
  ],
)

export type DecisionRow = InferSelectModel<typeof decisions>
