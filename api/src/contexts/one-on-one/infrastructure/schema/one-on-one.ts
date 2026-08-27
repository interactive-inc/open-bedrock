import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 1on1 の記録（参加者・実施日時・話題・所感・次アクション）。 */
export const oneOnOnes = sqliteTable("one_on_ones", {
  id: text("id").primaryKey(),
  memberId: text("member_id").$type<EmployeeId>().notNull(),
  managerId: text("manager_id").$type<EmployeeId>().notNull(),
  heldAt: text("held_at").notNull(),
  topics: text("topics"),
  managerNote: text("manager_note"),
  nextAction: text("next_action"),
  evaluationSheetId: integer("evaluation_sheet_id"),
})

export type OneOnOneRow = InferSelectModel<typeof oneOnOnes>
