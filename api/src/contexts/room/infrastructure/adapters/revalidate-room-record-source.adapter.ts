import type { RoomContext } from "@/contexts/room/configuration/room-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureRoomRecordAdapter } from "@/contexts/room/infrastructure/adapters/capture-room-record.adapter"
import { RoomError } from "@/contexts/room/domain/errors"
import { roomRecordKindSchema } from "@/contexts/room/domain/definitions/room-record-kind.definition"

type Context = RoomContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateRoomRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "room"
    )
      return new RoomError("forbidden", "record source does not belong to this room registry")

    const recordKind = roomRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success) return new RoomError("forbidden", "invalid room record kind")
    const current = await new CaptureRoomRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new RoomError("room_conflict", "room record differs from preservation proposal")

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
