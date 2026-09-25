import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** シフトパターン（勤務区分の雛形：勤務時間と休憩） */
export const shiftPatterns = sqliteTable(
  "shift_patterns",
  {
    id: text("id").primaryKey().notNull(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    breakMinutes: integer("break_minutes").notNull(),
    /** 作成日時。主キーの UUID は順序を持たないため、一覧の作成順に使う。 */
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("shift_patterns_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type ShiftPatternRow = InferSelectModel<typeof shiftPatterns>

/** シフト割当（社員ごとの日次シフト。published_at:null は下書き） */
export const shiftAssignments = sqliteTable(
  "shift_assignments",
  {
    id: text("id").primaryKey().notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    patternId: text("pattern_id"),
    date: text("date").notNull(),
    note: text("note"),
    publishedAt: text("published_at"),
    /** 作成日時。主キーの UUID は順序を持たないため、一覧の作成順に使う。 */
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("shift_assignments_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_shift_assignments_pattern").on(table.patternId),
    uniqueIndex("uq_shift_assignment_employee_date").on(table.employeeId, table.date),
  ],
)

export type ShiftAssignmentRow = InferSelectModel<typeof shiftAssignments>

/** シフト交代申請（申請者と交代相手・対象日・承認状態） */
export const shiftSwapRequests = sqliteTable(
  "shift_swap_requests",
  {
    id: text("id").primaryKey().notNull(),
    requesterEmployeeId: text("requester_employee_id").$type<EmployeeId>().notNull(),
    targetEmployeeId: text("target_employee_id").$type<EmployeeId>().notNull(),
    date: text("date").notNull(),
    note: text("note"),
    status: text("status").notNull(),
    approvedAt: text("approved_at"),
    /** 作成日時。主キーの UUID は順序を持たないため、一覧の作成順に使う。 */
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  // 同一の依頼者・対象者・日付で pending の交代申請は 1 件まで（二重申請を防ぐ）。
  (table) => [
    check("shift_swap_requests_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    uniqueIndex("idx_shift_swap_requests_pending")
      .on(table.requesterEmployeeId, table.targetEmployeeId, table.date)
      .where(sql`status = 'pending'`),
  ],
)

export type ShiftSwapRequestRow = InferSelectModel<typeof shiftSwapRequests>
