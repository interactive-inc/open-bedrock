import type { WorkAccidentContext } from "@/contexts/work-accident/configuration/work-accident-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureWorkAccidentRecordAdapter } from "@/contexts/work-accident/infrastructure/adapters/capture-work-accident-record.adapter"
import { WorkAccidentError } from "@/contexts/work-accident/domain/errors"

type Context = WorkAccidentContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateWorkAccidentRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "work-accident" ||
      source.props.recordKind !== "work-accident-record"
    )
      return new WorkAccidentError("forbidden", "record source does not belong to this work-accident registry")

    const current = await new CaptureWorkAccidentRecordAdapter(this.c).prepare({
      workAccidentId: Number(source.props.recordId),
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new WorkAccidentError(
        "work_accident_conflict",
        "work-accident record differs from preservation proposal",
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
