import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** アンケート（survey ドメイン）。questions_json は設問定義の JSON 文字列。 */
export const surveys = sqliteTable(
  "surveys",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    status: text("status").notNull(),
    questionsJson: text("questions_json").notNull(),
    /** 作成日時。主キーの UUID は順序を持たないため、一覧の作成順に使う。 */
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  () => [check("surveys_id_uuid", sql.raw(uuidCheckPredicate("id")))],
)

export type SurveyRow = InferSelectModel<typeof surveys>

/** アンケートへの回答。answers_json は回答内容の JSON 文字列。 */
export const surveyResponses = sqliteTable(
  "survey_responses",
  {
    id: text("id").primaryKey().notNull(),
    surveyId: text("survey_id").notNull(),
    respondentId: text("respondent_id").$type<EmployeeId>().notNull(),
    answersJson: text("answers_json").notNull(),
    submittedAt: text("submitted_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  // 1 アンケートにつき 1 回答者 1 件まで（二重回答を防ぐ）。
  (table) => [
    check("survey_responses_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    uniqueIndex("idx_survey_responses_survey_respondent").on(table.surveyId, table.respondentId),
  ],
)

export type SurveyResponseRow = InferSelectModel<typeof surveyResponses>
