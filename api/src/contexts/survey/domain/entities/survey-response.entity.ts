import type { SurveyResponseRow } from "@/contexts/survey/infrastructure/schema/survey"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  surveyId: z.number(),
  respondentId: z.number(),
  answersJson: z.unknown(),
  submittedAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** アンケートへの回答（回答者ごとの回答内容と提出時刻）。Survey 集約の内部エンティティ。 */
export class SurveyResponse implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly surveyId!: Props["surveyId"]

  readonly respondentId!: Props["respondentId"]

  readonly answersJson!: Props["answersJson"]

  readonly submittedAt!: Props["submittedAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規提出する回答を組み立てる。id は未採番。 */
  static create(props: {
    surveyId: number
    respondentId: number
    answersJson: unknown
    submittedAt: string
  }): SurveyResponse {
    return new SurveyResponse({
      id: null,
      surveyId: props.surveyId,
      respondentId: props.respondentId,
      answersJson: props.answersJson,
      submittedAt: props.submittedAt,
    })
  }

  static fromRow(row: SurveyResponseRow): SurveyResponse | Error {
    const answersJson = decodeAnswersJson(row.answersJson)

    if (answersJson instanceof Error) {
      return answersJson
    }

    return new SurveyResponse({
      id: row.id,
      surveyId: row.surveyId,
      respondentId: row.respondentId,
      answersJson: answersJson,
      submittedAt: row.submittedAt,
    })
  }

  /** 回答内容と提出時刻を差し替えた新しいインスタンスを返す。 */
  withAnswers(props: { answersJson: unknown; submittedAt: string }): SurveyResponse {
    return new SurveyResponse({
      id: this.id,
      surveyId: this.surveyId,
      respondentId: this.respondentId,
      answersJson: props.answersJson,
      submittedAt: props.submittedAt,
    })
  }
}

function decodeAnswersJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return new Error("survey_responses row answersJson is not valid JSON")
  }
}
