import type { AnnouncementContext } from "@/contexts/announcement/configuration/announcement-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureAnnouncementRecordAdapter } from "@/contexts/announcement/infrastructure/adapters/capture-announcement-record.adapter"
import { AnnouncementError } from "@/contexts/announcement/domain/errors"

type Context = AnnouncementContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateAnnouncementRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "announcement" ||
      source.props.recordKind !== "announcement-record"
    )
      return new AnnouncementError(
        "forbidden",
        "record source does not belong to this announcement registry",
      )

    const current = await new CaptureAnnouncementRecordAdapter(this.c).prepare({
      announcementId: Number(source.props.recordId),
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new AnnouncementError(
        "announcement_conflict",
        "announcement record differs from preservation proposal",
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
