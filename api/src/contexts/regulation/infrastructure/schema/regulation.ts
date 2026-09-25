import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 規程集（就業規則などの版管理台帳）。 */
export const regulations = sqliteTable(
  "regulations",
  {
    id: text("id").primaryKey().notNull(),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    category: text("category"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("regulations_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_regulations_status").on(table.status),
  ],
)

export type RegulationRow = InferSelectModel<typeof regulations>

/** 規程の改定版（version は整数の連番。同一規程内で version は一意）。 */
export const regulationVersions = sqliteTable(
  "regulation_versions",
  {
    id: text("id").primaryKey().notNull(),
    regulationId: text("regulation_id").notNull(),
    version: integer("version").notNull(),
    bodyMd: text("body_md").notNull(),
    effectiveOn: text("effective_on").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("regulation_versions_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    uniqueIndex("idx_regulation_versions_unique").on(table.regulationId, table.version),
    index("idx_regulation_versions_regulation").on(table.regulationId),
  ],
)

export type RegulationVersionRow = InferSelectModel<typeof regulationVersions>
