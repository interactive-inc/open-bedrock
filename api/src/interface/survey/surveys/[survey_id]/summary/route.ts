import { surveyQuestionSchema } from "@/domain/survey/survey-question"
import { toAnswerDistribution } from "@/domain/survey/to-answer-distribution"
import { toAnswersList } from "@/domain/survey/to-answers-list"
import { toTextAnswers } from "@/domain/survey/to-text-answers"
import { SurveyResponse } from "@/domain/survey/survey-response"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { BadRequestError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { surveyResponses, surveys } from "@/schema"
import { eq } from "drizzle-orm"

// GET /surveys/:survey_id/summary — 設問ごとに集計したアンケートサマリー
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }

  const surveyId = Number(c.req.param("survey_id"))

  if (!Number.isInteger(surveyId)) {
    throw new BadRequestError("invalid survey id")
  }

  const surveyRows = await c.var.database
    .select()
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1)

  const surveyRow = surveyRows.at(0)

  if (surveyRow === undefined) {
    throw new NotFoundError("survey not found")
  }

  const responseRows = await c.var.database
    .select()
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, surveyId))
    .orderBy(surveyResponses.id)

  const responses = responseRows.map(
    (row) =>
      new SurveyResponse({
        id: row.id,
        surveyId: row.surveyId,
        respondentId: row.respondentId,
        answersJson: JSON.parse(row.answersJson),
        submittedAt: row.submittedAt,
      }),
  )

  const answersList = toAnswersList(responses)

  const questions: Array<{
    id: string
    title: string
    type: "scale" | "choice" | "text"
    distribution: Record<string, number>
    answers: ReadonlyArray<string>
  }> = []

  for (const candidate of JSON.parse(surveyRow.questionsJson)) {
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
