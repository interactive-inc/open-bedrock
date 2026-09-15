import type { FamilyCareLeaveContext } from "@/contexts/family-care-leave/configuration/family-care-leave-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureFamilyCareLeaveRecordAdapter } from "@/contexts/family-care-leave/infrastructure/adapters/capture-family-care-leave-record.adapter"
import { FamilyCareLeaveError } from "@/contexts/family-care-leave/domain/errors"

type Context = FamilyCareLeaveContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateFamilyCareLeaveRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "family-care-leave" ||
      source.props.recordKind !== "family-care-leave-record"
    )
      return new FamilyCareLeaveError("forbidden", "record source does not belong to this family-care-leave registry")

    const current = await new CaptureFamilyCareLeaveRecordAdapter(this.c).prepare({
      familyCareLeaveId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new FamilyCareLeaveError(
        "family_care_leave_conflict",
        "family-care-leave record differs from preservation proposal",
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
