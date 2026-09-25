import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 産休・育休・介護休業の申出（期限管理と記録。給付金額の計算は持たない） */
export const familyCareLeaves = sqliteTable(
  "family_care_leaves",
  {
    id: text("id").primaryKey().notNull(),
    employeeId: text("employee_id").$type<EmployeeId>().notNull(),
    leaveKind: text("leave_kind").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    note: text("note"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  () => [check("family_care_leaves_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type FamilyCareLeaveRow = InferSelectModel<typeof familyCareLeaves>
