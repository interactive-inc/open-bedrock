import type { SurveyResponseRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  surveyId: z.number(),
  respondentId: z.number(),
  answersJson: z.unknown(),
  submittedAt: z.string(),
})

type Props = z.infer<typeof zProps>

// アンケートへの回答（回答者ごとの回答内容と提出時刻）。Survey 集約の内部エンティティ。
export class SurveyResponse implements Props {
  // 永続化前は null、DB 採番後に確定する。
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

  // 新規提出する回答を組み立てる。id は未採番。
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

  static fromRow(row: SurveyResponseRow): SurveyResponse {
    return new SurveyResponse({
      id: row.id,
      surveyId: row.surveyId,
      respondentId: row.respondentId,
      answersJson: JSON.parse(row.answersJson),
      submittedAt: row.submittedAt,
    })
  }
}
