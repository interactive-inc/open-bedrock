import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 取引先台帳（顧客・仕入先ほか。反社チェック・契約記録の親マスタ） */
export const partners = sqliteTable(
  "partners",
  {
    id: text("id").primaryKey().notNull(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    category: text("category"),
    corporateNumber: text("corporate_number"),
    note: text("note"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("partners_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type PartnerRow = InferSelectModel<typeof partners>

/** 契約記録（契約日・期間・更新期限の事実記録。中身のレビューや法的判定はしない） */
export const contracts = sqliteTable(
  "partner_contracts",
  {
    id: text("id").primaryKey().notNull(),
    partnerId: text("partner_id").notNull(),
    title: text("title").notNull(),
    contractDate: text("contract_date").notNull(),
    startsOn: text("starts_on"),
    endsOn: text("ends_on"),
    renewalDeadline: text("renewal_deadline"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  (table) => [
    check("partner_contracts_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    index("idx_contracts_partner").on(table.partnerId),
  ],
)

export type ContractRow = InferSelectModel<typeof contracts>
