import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 社内公募（部署・必要スキル・公開状態）。 */
export const careerPostings = sqliteTable("career_postings", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  deptId: integer("dept_id"),
  deptName: text("dept_name"),
  requiredSkills: text("required_skills"),
  status: text("status").notNull(),
})

export type CareerPostingRow = InferSelectModel<typeof careerPostings>

/** 公募への応募（応募者・メッセージ・状態）。id は AUTOINCREMENT。 */
export const careerApplications = sqliteTable(
  "career_applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postingId: integer("posting_id").notNull(),
    applicantId: integer("applicant_id").notNull(),
    message: text("message"),
    status: text("status").notNull(),
  },
  // 同一公募への重複応募を防ぐ。
  (table) => [
    uniqueIndex("idx_career_applications_posting_applicant").on(table.postingId, table.applicantId),
  ],
)

export type CareerApplicationRow = InferSelectModel<typeof careerApplications>

/** 社員ごとのキャリアシート（目標・強み）。employee_id が主キー。 */
export const careerSheets = sqliteTable("career_sheets", {
  employeeId: integer("employee_id").primaryKey(),
  goalsText: text("goals_text"),
  strengthsText: text("strengths_text"),
  updatedAt: text("updated_at").notNull(),
})

export type CareerSheetRow = InferSelectModel<typeof careerSheets>
