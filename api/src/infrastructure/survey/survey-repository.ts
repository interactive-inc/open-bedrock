import { Survey } from "@/domain/survey/survey"
import { SurveyResponse } from "@/domain/survey/survey-response"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { surveyResponses, surveys } from "@/schema"
import { and, asc, eq } from "drizzle-orm"

export type AlreadySubmittedError = { reason: "already_submitted" }

export class SurveyRepository {
  constructor(private readonly c: Context) {}

  async findById(surveyId: number): Promise<Survey | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(surveys)
        .where(eq(surveys.id, surveyId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Survey.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load survey")
    }
  }

  // アンケートを新規登録する。id は DB が採番し、登録後の行を返す。
  async create(survey: Survey): Promise<Survey | Error> {
    try {
      const rows = await this.c.var.database
        .insert(surveys)
        .values({
          title: survey.title,
          status: survey.status,
          questionsJson: JSON.stringify(survey.questionsJson),
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert survey") : Survey.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert survey")
    }
  }

  // アンケートの内容（タイトル・状態・設問）を id をキーに更新し、更新後の行を返す。
  async update(survey: Survey): Promise<Survey | Error> {
    if (survey.id === null) {
      return new Error("survey id is required")
    }

    try {
      const rows = await this.c.var.database
        .update(surveys)
        .set({
          title: survey.title,
          status: survey.status,
          questionsJson: JSON.stringify(survey.questionsJson),
        })
        .where(eq(surveys.id, survey.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to update survey") : Survey.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update survey")
    }
  }

  // アンケートを削除する。
  async delete(surveyId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(surveys).where(eq(surveys.id, surveyId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete survey")
    }
  }

  // 回答はアンケート集約に属するため、アンケートリポジトリが永続化する。
  // UNIQUE 制約 (survey_id, respondent_id) に違反した場合は already_submitted を返す。
  async createResponse(
    response: SurveyResponse,
  ): Promise<SurveyResponse | AlreadySubmittedError | Error> {
    try {
      const rows = await this.c.var.database
        .insert(surveyResponses)
        .values({
          surveyId: response.surveyId,
          respondentId: response.respondentId,
          answersJson: JSON.stringify(response.answersJson),
          submittedAt: response.submittedAt,
        })
        .returning()

      const row = rows.at(0)

      if (row === undefined) {
        return new Error("failed to insert survey response")
      }

      return SurveyResponse.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { reason: "already_submitted" }
      }
      return error instanceof Error ? error : new Error("failed to insert survey response")
    }
  }

  // 回答 id で1件取得する。存在しなければ null。
  async findResponseById(responseId: number): Promise<SurveyResponse | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(surveyResponses)
        .where(eq(surveyResponses.id, responseId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : SurveyResponse.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load survey response")
    }
  }

  // 回答者本人の回答を提出時刻の昇順で返す。
  async findResponsesByRespondentId(
    respondentId: number,
  ): Promise<ReadonlyArray<SurveyResponse> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(surveyResponses)
        .where(eq(surveyResponses.respondentId, respondentId))
        .orderBy(asc(surveyResponses.submittedAt))

      const responses: Array<SurveyResponse> = []

      for (const row of rows) {
        const response = SurveyResponse.fromRow(row)

        if (response instanceof Error) {
          return response
        }

        responses.push(response)
      }

      return responses
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load survey responses")
    }
  }

  // 回答内容と提出時刻を更新する。
  async updateResponse(response: SurveyResponse): Promise<SurveyResponse | Error> {
    if (response.id === null) {
      return new Error("survey response id is required")
    }

    try {
      await this.c.var.database
        .update(surveyResponses)
        .set({
          answersJson: JSON.stringify(response.answersJson),
          submittedAt: response.submittedAt,
        })
        .where(eq(surveyResponses.id, response.id))

      return response
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update survey response")
    }
  }

  // 回答を削除する。
  async deleteResponse(responseId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(surveyResponses).where(eq(surveyResponses.id, responseId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete survey response")
    }
  }

  async findResponseBySurveyIdAndRespondentId(
    surveyId: number,
    respondentId: number,
  ): Promise<SurveyResponse | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(surveyResponses)
        .where(
          and(
            eq(surveyResponses.surveyId, surveyId),
            eq(surveyResponses.respondentId, respondentId),
          ),
        )
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : SurveyResponse.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load survey response")
    }
  }
}
