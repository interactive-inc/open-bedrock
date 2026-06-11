import { toAnswers, toFormStatus, toReviewerType } from "@/domain/review/review-form-helpers"
import type { ReviewFormRow } from "@/schema"
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
