import type { InferSelectModel } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 規程集（就業規則などの版管理台帳）。 */
export const regulations = sqliteTable(
  "regulations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    category: text("category"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_regulations_status").on(table.status)],
)

export type RegulationRow = InferSelectModel<typeof regulations>

/** 規程の改定版（version は整数の連番。同一規程内で version は一意）。 */
export const regulationVersions = sqliteTable(
  "regulation_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    regulationId: integer("regulation_id").notNull(),
    version: integer("version").notNull(),
    bodyMd: text("body_md").notNull(),
    effectiveOn: text("effective_on").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_regulation_versions_unique").on(table.regulationId, table.version),
    index("idx_regulation_versions_regulation").on(table.regulationId),
  ],
)

export type RegulationVersionRow = InferSelectModel<typeof regulationVersions>
