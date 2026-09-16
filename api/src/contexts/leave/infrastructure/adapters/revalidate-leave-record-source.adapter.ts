import type { LeaveContext } from "@/contexts/leave/configuration/leave-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureLeaveRecordAdapter } from "@/contexts/leave/infrastructure/adapters/capture-leave-record.adapter"
import { LeaveError } from "@/contexts/leave/domain/errors"
import { leaveRecordKindSchema } from "@/contexts/leave/domain/definitions/leave-record-kind.definition"

type Context = LeaveContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateLeaveRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "leave"
    )
      return new LeaveError("forbidden", "record source does not belong to this leave registry")

    const recordKind = leaveRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success) return new LeaveError("forbidden", "invalid leave record kind")
    const current = await new CaptureLeaveRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new LeaveError("leave_conflict", "leave record differs from preservation proposal")

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
