import type { ItIncidentContext } from "@/contexts/it-incident/configuration/it-incident-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureItIncidentRecordAdapter } from "@/contexts/it-incident/infrastructure/adapters/capture-it-incident-record.adapter"
import { ItIncidentError } from "@/contexts/it-incident/domain/errors"

type Context = ItIncidentContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateItIncidentRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "it-incident" ||
      source.props.recordKind !== "it-incident-record"
    )
      return new ItIncidentError(
        "forbidden",
        "record source does not belong to this it-incident registry",
      )

    const current = await new CaptureItIncidentRecordAdapter(this.c).prepare({
      itIncidentId: Number(source.props.recordId),
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new ItIncidentError(
        "it_incident_conflict",
        "it-incident record differs from preservation proposal",
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
