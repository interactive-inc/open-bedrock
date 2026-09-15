import type { ResignationContext } from "@/contexts/resignation/configuration/resignation-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureResignationRecordAdapter } from "@/contexts/resignation/infrastructure/adapters/capture-resignation-record.adapter"
import { ResignationError } from "@/contexts/resignation/domain/errors"

type Context = ResignationContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateResignationRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "resignation" ||
      source.props.recordKind !== "resignation-record"
    )
      return new ResignationError("forbidden", "record source does not belong to this resignation registry")

    const current = await new CaptureResignationRecordAdapter(this.c).prepare({
      resignationId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new ResignationError(
        "resignation_conflict",
        "resignation record differs from preservation proposal",
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
