import type { DisciplinaryActionContext } from "@/contexts/disciplinary-action/configuration/disciplinary-action-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureDisciplinaryActionRecordAdapter } from "@/contexts/disciplinary-action/infrastructure/adapters/capture-disciplinary-action-record.adapter"
import { DisciplinaryActionError } from "@/contexts/disciplinary-action/domain/errors"

type Context = DisciplinaryActionContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateDisciplinaryActionRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "disciplinary-action" ||
      source.props.recordKind !== "disciplinary-action-record"
    )
      return new DisciplinaryActionError("forbidden", "record source does not belong to this disciplinary-action registry")

    const current = await new CaptureDisciplinaryActionRecordAdapter(this.c).prepare({
      disciplinaryActionId: Number(source.props.recordId),
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new DisciplinaryActionError(
        "disciplinary_action_conflict",
        "disciplinary-action record differs from preservation proposal",
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
