import type { RegulationContext } from "@/contexts/regulation/configuration/regulation-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureRegulationRecordAdapter } from "@/contexts/regulation/infrastructure/adapters/capture-regulation-record.adapter"
import { RegulationError } from "@/contexts/regulation/domain/errors"
import { regulationRecordKindSchema } from "@/contexts/regulation/domain/definitions/regulation-record-kind.definition"

type Context = RegulationContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateRegulationRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "regulation"
    )
      return new RegulationError(
        "forbidden",
        "record source does not belong to this regulation registry",
      )

    const recordKind = regulationRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success)
      return new RegulationError("forbidden", "invalid regulation record kind")
    const current = await new CaptureRegulationRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new RegulationError(
        "regulation_conflict",
        "regulation record differs from preservation proposal",
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
