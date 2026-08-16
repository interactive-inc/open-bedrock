import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 産休・育休・介護休業の申出（期限管理と記録。給付金額の計算は持たない） */
export const familyCareLeaves = sqliteTable("family_care_leaves", {
  id: text("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  leaveKind: text("leave_kind").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  note: text("note"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type FamilyCareLeaveRow = InferSelectModel<typeof familyCareLeaves>
