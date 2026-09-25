import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** ライセンス・SaaS 台帳（更新期限・管理担当の事実記録。支払・会計連動は持たない） */
export const licenses = sqliteTable(
  "software_licenses",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    vendor: text("vendor"),
    planName: text("plan_name"),
    revision: integer("revision").notNull().default(0),
    category: text("category"),
    seats: integer("seats"),
    renewalDeadline: text("renewal_deadline"),
    ownerEmployeeId: text("owner_employee_id").$type<EmployeeId>(),
    note: text("note"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("software_licenses_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type LicenseRow = InferSelectModel<typeof licenses>
