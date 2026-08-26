import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/**
 * 役職マスタ（並び順の rank を持つ役職の定義。判定・計算は持たず定義のみ。
 * 役職の期間付き履歴は人事発令が正で、割当履歴テーブルは持たない）
 */
export const positions = sqliteTable(
  "company_position_definitions",
  {
    id: integer("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    rank: integer("rank").notNull(),
    description: text("description"),
    createdAt: text("created_at").notNull(),
  },
  // 役職コードは全社で一意（同一コードの二重登録を防ぐ）。
  (table) => [uniqueIndex("uq_company_position_definitions_code").on(table.code)],
)

export type PositionRow = InferSelectModel<typeof positions>
