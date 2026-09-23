import type { BusinessTripContext } from "@/contexts/business-trip/configuration/business-trip-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureBusinessTripRecordAdapter } from "@/contexts/business-trip/infrastructure/adapters/capture-business-trip-record.adapter"
import { BusinessTripError } from "@/contexts/business-trip/domain/errors"

type Context = BusinessTripContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateBusinessTripRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "business-trip" ||
      source.props.recordKind !== "business-trip-record"
    )
      return new BusinessTripError(
        "forbidden",
        "record source does not belong to this business-trip registry",
      )

    const current = await new CaptureBusinessTripRecordAdapter(this.c).prepare({
      businessTripId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new BusinessTripError(
        "business_trip_conflict",
        "business-trip record differs from preservation proposal",
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
