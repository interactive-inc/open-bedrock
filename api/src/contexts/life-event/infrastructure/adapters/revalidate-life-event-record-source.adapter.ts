import type { LifeEventContext } from "@/contexts/life-event/configuration/life-event-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureLifeEventRecordAdapter } from "@/contexts/life-event/infrastructure/adapters/capture-life-event-record.adapter"
import { LifeEventError } from "@/contexts/life-event/domain/errors"

type Context = LifeEventContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateLifeEventRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "life-event" ||
      source.props.recordKind !== "life-event-record"
    )
      return new LifeEventError("forbidden", "record source does not belong to this life-event registry")

    const current = await new CaptureLifeEventRecordAdapter(this.c).prepare({
      lifeEventId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new LifeEventError(
        "life_event_conflict",
        "life-event record differs from preservation proposal",
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
