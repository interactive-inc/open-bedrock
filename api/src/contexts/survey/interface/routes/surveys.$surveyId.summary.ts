import { Survey } from "@/contexts/survey/domain/entities/survey.entity"
import { surveyQuestionSchema } from "@/contexts/survey/domain/definitions/survey-question.definition"
import { toAnswerDistribution } from "@/contexts/survey/interface/http/surveys/[survey_id]/summary/to-answer-distribution"
import { toAnswersList } from "@/contexts/survey/interface/http/surveys/[survey_id]/summary/to-answers-list"
import { toTextAnswers } from "@/contexts/survey/interface/http/surveys/[survey_id]/summary/to-text-answers"
import { SurveyResponse } from "@/contexts/survey/domain/entities/survey-response.entity"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ForbiddenError, InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { zAppSurveySummary } from "@/contexts/survey/interface/http/response-schemas"
import { surveyResponses, surveys } from "@/contexts/survey/infrastructure/schema/survey"
import { count, eq } from "drizzle-orm"

/**
 * D1 の応答サイズ上限（16MB）と Worker CPU タイムアウト対策として、集計に使う回答数の上限を設ける。
 * 上限を超える場合は is_truncated: true を付与し、先頭 MAX_SUMMARY_RESPONSES 件で集計する。
 */
const MAX_SUMMARY_RESPONSES = 1000

// @authorization permission - 権限キーで判定する
/**
 * GET /surveys/:surveyId/summary — 設問ごとに集計したアンケートサマリー（管理ロールのみ）。
 * 自由記述を含む集計を返すため、回答の機微情報の保護として閲覧を管理ロールに限定する。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }

  if (c.var.session.hasPermission("survey:manage") === false) {
    throw new ForbiddenError()
  }

  const surveyId = validateIntParam(c.req.param("surveyId"), "survey")

  const surveyRows = await c.var.database
    .select()
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1)

  const surveyRow = surveyRows.at(0)

  if (surveyRow === undefined) {
    throw new NotFoundError("survey not found")
  }

  const responseCountRows = await c.var.database
    .select({ value: count() })
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, surveyId))

  const responseCount = responseCountRows.at(0)?.value ?? 0

  const responseRows = await c.var.database
    .select()
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, surveyId))
    .orderBy(surveyResponses.id)
    .limit(MAX_SUMMARY_RESPONSES)

  const responses = responseRows.map((row) => {
    let answersJson: unknown
    try {
      answersJson = JSON.parse(row.answersJson)
    } catch {
      throw new InternalError("invalid answers_json data")
    }
    return new SurveyResponse({
      id: row.id,
      surveyId: row.surveyId,
      respondentId: row.respondentId,
      answersJson,
      submittedAt: row.submittedAt,
    })
  })

  const answersList = toAnswersList(responses)

  const questions: Array<{
    id: string
    title: string
    type: "scale" | "choice" | "text"
    distribution: Record<string, number>
    answers: ReadonlyArray<string>
  }> = []

  const survey = Survey.fromRow(surveyRow)

  if (survey instanceof Error) {
    throw new InternalError("internal server error")
  }

  for (const candidate of survey.questionsJson) {
    const parsed = surveyQuestionSchema.safeParse(candidate)

    if (parsed.success) {
      questions.push({
        id: parsed.data.id,
        title: parsed.data.text,
        type: parsed.data.type,
        distribution: toAnswerDistribution(parsed.data.id, answersList),
        answers: toTextAnswers(parsed.data.id, answersList),
      })
    }
  }

  const responseBody = zAppSurveySummary.parse({
    survey_id: surveyRow.id,
    title: surveyRow.title,
    response_count: responseCount,
    is_truncated: responseCount > MAX_SUMMARY_RESPONSES,
    questions,
  })

  return c.json(responseBody, 200)
})
