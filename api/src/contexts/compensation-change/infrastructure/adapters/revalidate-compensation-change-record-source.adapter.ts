import type { CompensationChangeContext } from "@/contexts/compensation-change/configuration/compensation-change-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureCompensationChangeRecordAdapter } from "@/contexts/compensation-change/infrastructure/adapters/capture-compensation-change-record.adapter"
import { CompensationChangeError } from "@/contexts/compensation-change/domain/errors"
import { compensationChangeRecordKindSchema } from "@/contexts/compensation-change/domain/definitions/compensation-change-record-kind.definition"

type Context = CompensationChangeContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateCompensationChangeRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "compensation-change"
    )
      return new CompensationChangeError(
        "forbidden",
        "record source does not belong to this compensation-change registry",
      )

    const recordKind = compensationChangeRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success)
      return new CompensationChangeError("forbidden", "invalid compensation-change record kind")
    const current = await new CaptureCompensationChangeRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new CompensationChangeError(
        "compensation-change_conflict",
        "compensation-change record differs from preservation proposal",
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
