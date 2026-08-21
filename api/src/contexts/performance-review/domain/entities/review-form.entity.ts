import { toAnswers } from "@/contexts/performance-review/domain/values/review-answers.definition"
import { toFormStatus } from "@/contexts/performance-review/domain/values/review-form-status.definition"
import { toReviewerType } from "@/contexts/performance-review/domain/values/reviewer-type.definition"
import { toVisibility } from "@/contexts/performance-review/domain/values/review-visibility.definition"
import type { ReviewFormRow } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  cycleId: z.number(),
  subjectEmployeeId: z.number(),
  reviewerEmployeeId: z.number(),
  reviewerType: z.enum(["self", "manager", "peer", "subordinate"]),
  answers: z.array(z.unknown()).readonly(),
  // 0〜100 の整数のみ。DB に不正値が混入しても fromRow で弾く。
  score: z.number().int().min(0).max(100).nullable(),
  comment: z.string().nullable(),
  status: z.enum(["pending", "submitted"]),
  submittedAt: z.string().nullable(),
  // hidden は被評価者本人に非公開、disclosed で本人閲覧可。
  visibility: z.enum(["hidden", "disclosed"]),
})

type Props = z.infer<typeof zProps>

export class ReviewForm implements Props {
  readonly id!: Props["id"]
  readonly cycleId!: Props["cycleId"]
  readonly subjectEmployeeId!: Props["subjectEmployeeId"]
  readonly reviewerEmployeeId!: Props["reviewerEmployeeId"]
  readonly reviewerType!: Props["reviewerType"]
  readonly answers!: Props["answers"]
  readonly score!: Props["score"]
  readonly comment!: Props["comment"]
  readonly status!: Props["status"]
  readonly submittedAt!: Props["submittedAt"]
  readonly visibility!: Props["visibility"]

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
      comment: row.comment ?? null,
      status: toFormStatus(row.status),
      submittedAt: row.submittedAt,
      visibility: toVisibility(row.visibility),
    })
  }

  withSubmission(
    score: Props["score"],
    answers: Props["answers"],
    comment: Props["comment"],
    submittedAt: string,
  ) {
    return new ReviewForm({
      ...this.props,
      score,
      answers,
      comment,
      status: "submitted",
      submittedAt,
    })
  }
}
