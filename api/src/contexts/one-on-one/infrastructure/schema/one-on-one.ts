import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 1on1 の記録（参加者・実施日時・話題・所感・次アクション）。 */
export const oneOnOnes = sqliteTable(
  "one_on_ones",
  {
    id: text("id").primaryKey().notNull(),
    memberId: text("member_id").$type<EmployeeId>().notNull(),
    managerId: text("manager_id").$type<EmployeeId>().notNull(),
    heldAt: text("held_at").notNull(),
    topics: text("topics"),
    managerNote: text("manager_note"),
    nextAction: text("next_action"),
    /** 過去に連携していた外部記録の参照。1on1は解釈せず、書き込まず、保全のために値だけを保持する。 */
    externalReference: integer("external_reference"),
  },
  () => [check("one_on_ones_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type OneOnOneRow = InferSelectModel<typeof oneOnOnes>
