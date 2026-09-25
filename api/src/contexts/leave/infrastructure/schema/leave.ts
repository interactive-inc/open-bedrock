import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type {
  LeaveStatus,
  LeaveType,
  LeaveUnit,
} from "@/contexts/leave/domain/definitions/leave-request.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core"

/** 休暇申請（本人の申請・承認/却下の記録）。id は UUID。 */
export const leaveRequests = sqliteTable(
  "leave_requests",
  {
    id: text("id").primaryKey().notNull(),
    // 修正下書きの作成時から変更できない差戻し元。
    previousLeaveRequestId: text("previous_leave_request_id"),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    leaveType: text("leave_type").notNull().$type<LeaveType>(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    days: integer("days").notNull(),
    unit: text("unit").notNull().$type<LeaveUnit>(),
    hours: real("hours"),
    // 残数消費量（按分計算後）。半休=0.5、時間休=時間数/8、全休=days と同じ。
    consumedDays: real("consumed_days").notNull(),
    reason: text("reason"),
    status: text("status").notNull().$type<LeaveStatus>(),
    approverId: text("approver_id").$type<EmployeeId>(),
    decidedComment: text("decided_comment"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("leave_requests_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type LeaveRequestRow = InferSelectModel<typeof leaveRequests>

/** 年度ごとの休暇残数（付与・消化・残）。employee_id + fiscal_year + leave_type で一意。 */
export const leaveBalances = sqliteTable(
  "leave_balances",
  {
    id: text("id").primaryKey().notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    fiscalYear: text("fiscal_year").notNull(),
    leaveType: text("leave_type").notNull().$type<LeaveType>(),
    // 半休(0.5)・時間休(時間数/8)の按分に対応するため REAL。
    grantedDays: real("granted_days").notNull(),
    usedDays: real("used_days").notNull(),
    remainingDays: real("remaining_days").notNull(),
  },
  (table) => [
    check("leave_balances_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    unique().on(table.employeeId, table.fiscalYear, table.leaveType),
  ],
)

export type LeaveBalanceRow = InferSelectModel<typeof leaveBalances>
