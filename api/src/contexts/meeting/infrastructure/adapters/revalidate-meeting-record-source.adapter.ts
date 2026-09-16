import type { MeetingContext } from "@/contexts/meeting/configuration/meeting-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureMeetingRecordAdapter } from "@/contexts/meeting/infrastructure/adapters/capture-meeting-record.adapter"
import { MeetingError } from "@/contexts/meeting/domain/errors"
import { meetingRecordKindSchema } from "@/contexts/meeting/domain/definitions/meeting-record-kind.definition"

type Context = MeetingContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateMeetingRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "meeting"
    )
      return new MeetingError("forbidden", "record source does not belong to this meeting registry")

    const recordKind = meetingRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success) return new MeetingError("forbidden", "invalid meeting record kind")
    const current = await new CaptureMeetingRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new MeetingError(
        "meeting_conflict",
        "meeting record differs from preservation proposal",
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
