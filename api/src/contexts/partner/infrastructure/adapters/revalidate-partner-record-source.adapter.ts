import type { PartnerContext } from "@/contexts/partner/configuration/partner-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CapturePartnerRecordAdapter } from "@/contexts/partner/infrastructure/adapters/capture-partner-record.adapter"
import { PartnerError } from "@/contexts/partner/domain/errors"
import { partnerRecordKindSchema } from "@/contexts/partner/domain/definitions/partner-record-kind.definition"

type Context = PartnerContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidatePartnerRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "partner"
    )
      return new PartnerError("forbidden", "record source does not belong to this partner registry")

    const recordKind = partnerRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success) return new PartnerError("forbidden", "invalid partner record kind")
    const current = await new CapturePartnerRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new PartnerError(
        "partner_conflict",
        "partner record differs from preservation proposal",
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
