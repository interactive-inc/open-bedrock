import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** シフトパターン（勤務区分の雛形：勤務時間と休憩） */
export const shiftPatterns = sqliteTable("shift_patterns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  breakMinutes: integer("break_minutes").notNull(),
})

export type ShiftPatternRow = InferSelectModel<typeof shiftPatterns>

/** シフト割当（社員ごとの日次シフト。published_at:null は下書き） */
export const shiftAssignments = sqliteTable(
  "shift_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    patternId: integer("pattern_id"),
    date: text("date").notNull(),
    note: text("note"),
    publishedAt: text("published_at"),
  },
  (table) => [
    index("idx_shift_assignments_pattern").on(table.patternId),
    uniqueIndex("uq_shift_assignment_employee_date").on(table.employeeId, table.date),
  ],
)

export type ShiftAssignmentRow = InferSelectModel<typeof shiftAssignments>

/** シフト交代申請（申請者と交代相手・対象日・承認状態） */
export const shiftSwapRequests = sqliteTable(
  "shift_swap_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requesterEmployeeId: text("requester_employee_id").$type<EmployeeId>().notNull(),
    targetEmployeeId: text("target_employee_id").$type<EmployeeId>().notNull(),
    date: text("date").notNull(),
    note: text("note"),
    status: text("status").notNull(),
    approvedAt: text("approved_at"),
  },
  // 同一の依頼者・対象者・日付で pending の交代申請は 1 件まで（二重申請を防ぐ）。
  (table) => [
    uniqueIndex("idx_shift_swap_requests_pending")
      .on(table.requesterEmployeeId, table.targetEmployeeId, table.date)
      .where(sql`status = 'pending'`),
  ],
)

export type ShiftSwapRequestRow = InferSelectModel<typeof shiftSwapRequests>
