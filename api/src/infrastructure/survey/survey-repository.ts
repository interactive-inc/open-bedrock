import { Survey } from "@/domain/survey/survey"
import { SurveyResponse } from "@/domain/survey/survey-response"
import type { Context } from "@/env"
import { surveyResponses, surveys } from "@/schema"
import { and, eq } from "drizzle-orm"

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

  // 回答はアンケート集約に属するため、アンケートリポジトリが永続化する。
  async createResponse(response: SurveyResponse): Promise<SurveyResponse | Error> {
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
      return error instanceof Error ? error : new Error("failed to insert survey response")
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
