import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** アンケート（survey ドメイン）。questions_json は設問定義の JSON 文字列。 */
export const surveys = sqliteTable("surveys", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  questionsJson: text("questions_json").notNull(),
})

export type SurveyRow = InferSelectModel<typeof surveys>

/** アンケートへの回答。id は自動採番。answers_json は回答内容の JSON 文字列。 */
export const surveyResponses = sqliteTable(
  "survey_responses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    surveyId: integer("survey_id").notNull(),
    respondentId: integer("respondent_id").notNull(),
    answersJson: text("answers_json").notNull(),
    submittedAt: text("submitted_at").notNull(),
  },
  // 1 アンケートにつき 1 回答者 1 件まで（二重回答を防ぐ）。
  (table) => [
    uniqueIndex("idx_survey_responses_survey_respondent").on(table.surveyId, table.respondentId),
  ],
)

export type SurveyResponseRow = InferSelectModel<typeof surveyResponses>
