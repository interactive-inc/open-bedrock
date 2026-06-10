import { canManageSurveys } from "@/domain/survey/can-manage-surveys"
import { surveyQuestionSchema } from "@/domain/survey/survey-question"
import { toAnswerDistribution } from "@/domain/survey/to-answer-distribution"
import { toAnswersList } from "@/domain/survey/to-answers-list"
import { toTextAnswers } from "@/domain/survey/to-text-answers"
import { SurveyResponse } from "@/domain/survey/survey-response"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { surveyResponses, surveys } from "@/schema"
import { eq } from "drizzle-orm"

// GET /surveys/:survey_id/summary — 設問ごとに集計したアンケートサマリー（管理ロールのみ）。
// 自由記述を含む集計を返すため、回答の機微情報の保護として閲覧を管理ロールに限定する。
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }

  if (canManageSurveys(c.var.session.role) === false) {
    throw new ForbiddenError()
  }

  const surveyId = validateIntParam(c.req.param("survey_id"), "survey")

  const surveyRows = await c.var.database
    .select()
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1)

  const surveyRow = surveyRows.at(0)

  if (surveyRow === undefined) {
    throw new NotFoundError("survey not found")
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const responseRows = await c.var.database
    .select()
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, surveyId))
    .orderBy(surveyResponses.id)
    .limit(limit)
    .offset(offset)

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

  let questionsJsonParsed: unknown
  try {
    questionsJsonParsed = JSON.parse(surveyRow.questionsJson)
  } catch {
    throw new InternalError("invalid questions_json data")
  }

  for (const candidate of Array.isArray(questionsJsonParsed) ? questionsJsonParsed : []) {
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

  const responseBody = {
    survey_id: surveyRow.id,
    title: surveyRow.title,
    response_count: responses.length,
    questions,
  }

  return c.json(responseBody, 200)
})
