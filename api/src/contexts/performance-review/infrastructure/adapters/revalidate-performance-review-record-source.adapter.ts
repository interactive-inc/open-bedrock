import type { PerformanceReviewContext } from "@/contexts/performance-review/configuration/performance-review-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CapturePerformanceReviewRecordAdapter } from "@/contexts/performance-review/infrastructure/adapters/capture-performance-review-record.adapter"
import { PerformanceReviewError } from "@/contexts/performance-review/domain/errors"
import { performanceReviewRecordKindSchema } from "@/contexts/performance-review/domain/definitions/performance-review-record-kind.definition"

type Context = PerformanceReviewContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidatePerformanceReviewRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "performance-review"
    )
      return new PerformanceReviewError(
        "forbidden",
        "record source does not belong to this performanceReview registry",
      )

    const recordKind = performanceReviewRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success)
      return new PerformanceReviewError("forbidden", "invalid performanceReview record kind")
    const current = await new CapturePerformanceReviewRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new PerformanceReviewError(
        "performance_review_conflict",
        "performanceReview record differs from preservation proposal",
      )

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
