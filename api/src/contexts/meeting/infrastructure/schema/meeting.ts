import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 会議体マスタ（定例会議などの器。cadence は開催頻度メモ） */
export const meetings = sqliteTable(
  "meetings",
  {
    id: integer("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    cadence: text("cadence"),
    description: text("description"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_meetings_status").on(table.status)],
)

export type MeetingRow = InferSelectModel<typeof meetings>

/** 議事録（会議体ごとの開催記録） */
export const meetingMinutes = sqliteTable(
  "meeting_minutes_records",
  {
    id: integer("id").primaryKey(),
    meetingId: integer("meeting_id").notNull(),
    heldOn: text("held_on").notNull(),
    title: text("title").notNull(),
    attendees: text("attendees"),
    bodyMd: text("body_md").notNull(),
    authorEmployeeId: text("author_employee_id").$type<EmployeeId>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_meeting_minutes_meeting").on(table.meetingId)],
)

export type MeetingMinutesRow = InferSelectModel<typeof meetingMinutes>

/** 意思決定記録（ADR 形式。文脈・決定・帰結を記録し、後続の決定で supersede する） */
export const decisions = sqliteTable(
  "decision_records",
  {
    id: integer("id").primaryKey(),
    title: text("title").notNull(),
    decidedOn: text("decided_on").notNull(),
    context: text("context").notNull(),
    decision: text("decision").notNull(),
    consequences: text("consequences"),
    status: text("status").notNull(),
    supersededById: integer("superseded_by_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_decisions_status").on(table.status)],
)

export type DecisionRow = InferSelectModel<typeof decisions>
