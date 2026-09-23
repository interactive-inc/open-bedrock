import type { CommendationContext } from "@/contexts/commendation/configuration/commendation-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureCommendationRecordAdapter } from "@/contexts/commendation/infrastructure/adapters/capture-commendation-record.adapter"
import { CommendationError } from "@/contexts/commendation/domain/errors"

type Context = CommendationContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateCommendationRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "commendation" ||
      source.props.recordKind !== "commendation-record"
    )
      return new CommendationError(
        "forbidden",
        "record source does not belong to this commendation registry",
      )

    const current = await new CaptureCommendationRecordAdapter(this.c).prepare({
      commendationId: Number(source.props.recordId),
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new CommendationError(
        "commendation_conflict",
        "commendation record differs from preservation proposal",
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
