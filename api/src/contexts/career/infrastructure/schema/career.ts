import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 社内公募（部署・必要スキル・公開状態）。 */
export const careerPostings = sqliteTable(
  "career_postings",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    // 参照先を持たない既存の不具合。UUID 化の対象外 (Issue #1329)。
    deptId: integer("dept_id"),
    deptName: text("dept_name"),
    requiredSkills: text("required_skills"),
    status: text("status").notNull(),
  },
  (table) => [
    index("idx_career_postings_status").on(table.status),
    check("career_postings_id_uuid", sql.raw(uuidCheckPredicate("id"))),
  ],
)

export type CareerPostingRow = InferSelectModel<typeof careerPostings>

/** 公募への応募（応募者・メッセージ・状態）。id は AUTOINCREMENT。 */
export const careerApplications = sqliteTable(
  "career_applications",
  {
    id: text("id").primaryKey(),
    postingId: text("posting_id")
      .notNull()
      .references(() => careerPostings.id, { onDelete: "restrict" }),
    applicantId: text("applicant_id").$type<EmployeeId>().notNull(),
    message: text("message"),
    status: text("status").notNull(),
  },
  // 同一公募への重複応募を防ぐ。
  (table) => [
    index("idx_career_applications_applicant").on(table.applicantId),
    index("idx_career_applications_posting").on(table.postingId),
    uniqueIndex("idx_career_applications_posting_applicant").on(table.postingId, table.applicantId),
    check("career_applications_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    check("career_applications_posting_id_uuid", sql.raw(uuidCheckPredicate("posting_id"))),
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
