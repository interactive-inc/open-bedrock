import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type {
  EmployeeId,
  OrganizationUnitId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { organizationUnits } from "@/contexts/company/infrastructure/schema/organization"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/**
 * 社内公募（募集部署・必要スキル・公開状態）。
 * 募集部署は organization_unit_id で Company の組織単位を参照する。書込み時に Company の
 * 公開 operation で会社営業日に有効な単位かを検査する。
 * dept_id と dept_name は組織単位を参照できなかった頃の旧記録で、保持するが書き込まない。
 */
export const careerPostings = sqliteTable(
  "career_postings",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    deptId: integer("dept_id"),
    deptName: text("dept_name"),
    organizationUnitId: text("organization_unit_id")
      .$type<OrganizationUnitId>()
      .references(() => organizationUnits.id, { onDelete: "restrict" }),
    requiredSkills: text("required_skills"),
    status: text("status").notNull(),
    /** 作成日時。主キーの UUID は順序を持たないため、一覧の作成順に使う。 */
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("career_postings_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type CareerPostingRow = InferSelectModel<typeof careerPostings>

/** 公募への応募（応募者・メッセージ・状態）。posting_id は同じ業務の公募の UUID を外部キーなしで指す。 */
export const careerApplications = sqliteTable(
  "career_applications",
  {
    id: text("id").primaryKey().notNull(),
    postingId: text("posting_id").notNull(),
    applicantId: text("applicant_id").$type<EmployeeId>().notNull(),
    message: text("message"),
    status: text("status").notNull(),
    /** 作成日時。主キーの UUID は順序を持たないため、一覧の作成順に使う。 */
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  // 同一公募への重複応募を防ぐ。
  (table) => [
    check("career_applications_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    uniqueIndex("idx_career_applications_posting_applicant").on(table.postingId, table.applicantId),
  ],
)

export type CareerApplicationRow = InferSelectModel<typeof careerApplications>

/** 社員ごとのキャリアシート（目標・強み）。employee_id が主キー。 */
export const careerSheets = sqliteTable("career_sheets", {
  employeeId: text("employee_id").$type<EmployeeId>().primaryKey(),
  goalsText: text("goals_text"),
  strengthsText: text("strengths_text"),
  updatedAt: text("updated_at").notNull(),
})

export type CareerSheetRow = InferSelectModel<typeof careerSheets>
