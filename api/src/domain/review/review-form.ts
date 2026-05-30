import type { ReviewFormRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  cycleId: z.number(),
  subjectEmployeeId: z.number(),
  reviewerEmployeeId: z.number(),
  reviewerType: z.enum(["self", "manager", "peer", "subordinate"]),
  answers: z.array(z.unknown()).readonly(),
  score: z.number().nullable(),
  status: z.enum(["pending", "submitted"]),
  submittedAt: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

// 評価フォーム（サイクル・被評価者・評価者ごとの回答とスコア・状態）。集約ルート。
export class ReviewForm implements Props {
  readonly id!: Props["id"]

  readonly cycleId!: Props["cycleId"]

  readonly subjectEmployeeId!: Props["subjectEmployeeId"]

  readonly reviewerEmployeeId!: Props["reviewerEmployeeId"]

  readonly reviewerType!: Props["reviewerType"]

  readonly answers!: Props["answers"]

  readonly score!: Props["score"]

  readonly status!: Props["status"]

  readonly submittedAt!: Props["submittedAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(row: ReviewFormRow): ReviewForm {
    return new ReviewForm({
      id: row.id,
      cycleId: row.cycleId,
      subjectEmployeeId: row.subjectEmployeeId,
      reviewerEmployeeId: row.reviewerEmployeeId,
      reviewerType: toReviewerType(row.reviewerType),
      answers: toAnswers(row.answers),
      score: row.score,
      status: toFormStatus(row.status),
      submittedAt: row.submittedAt,
    })
  }

  withSubmission(score: Props["score"], answers: Props["answers"], submittedAt: string) {
    return new ReviewForm({
      ...this.props,
      score,
      answers,
      status: "submitted",
      submittedAt,
    })
  }
}

function toReviewerType(value: string): "self" | "manager" | "peer" | "subordinate" {
  if (value === "manager") {
    return "manager"
  }

  if (value === "peer") {
    return "peer"
  }

  if (value === "subordinate") {
    return "subordinate"
  }

  return "self"
}

function toFormStatus(value: string): "pending" | "submitted" {
  return value === "submitted" ? "submitted" : "pending"
}

function toAnswers(value: string): ReadonlyArray<unknown> {
  try {
    const decoded: unknown = JSON.parse(value)

    return Array.isArray(decoded) ? decoded : []
  } catch {
    return []
  }
}
