import type { LeaveStatus, LeaveType, LeaveUnit } from "@/lib/schemas"
import type { InferSelectModel } from "drizzle-orm"
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 休暇申請（本人の申請・承認/却下の記録）。id は自動採番。 */
export const leaveRequests = sqliteTable("leave_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
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
  approverId: integer("approver_id"),
  decidedComment: text("decided_comment"),
  createdAt: text("created_at").notNull(),
})

export type LeaveRequestRow = InferSelectModel<typeof leaveRequests>

/** 年度ごとの休暇残数（付与・消化・残）。employee_id + fiscal_year + leave_type が主キー。 */
export const leaveBalances = sqliteTable(
  "leave_balances",
  {
    employeeId: integer("employee_id").notNull(),
    fiscalYear: text("fiscal_year").notNull(),
    leaveType: text("leave_type").notNull().$type<LeaveType>(),
    // 半休(0.5)・時間休(時間数/8)の按分に対応するため REAL。
    grantedDays: real("granted_days").notNull(),
    usedDays: real("used_days").notNull(),
    remainingDays: real("remaining_days").notNull(),
  },
  (table) => [primaryKey({ columns: [table.employeeId, table.fiscalYear, table.leaveType] })],
)

export type LeaveBalanceRow = InferSelectModel<typeof leaveBalances>
