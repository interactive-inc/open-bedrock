import type { ShiftContext } from "@/contexts/shift/configuration/shift-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureShiftRecordAdapter } from "@/contexts/shift/infrastructure/adapters/capture-shift-record.adapter"
import { ShiftError } from "@/contexts/shift/domain/errors"
import { shiftRecordKindSchema } from "@/contexts/shift/domain/definitions/shift-record-kind.definition"

type Context = ShiftContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateShiftRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "shift"
    )
      return new ShiftError("forbidden", "record source does not belong to this shift registry")

    const recordKind = shiftRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success) return new ShiftError("forbidden", "invalid shift record kind")
    const current = await new CaptureShiftRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new ShiftError("shift_conflict", "shift record differs from preservation proposal")

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
