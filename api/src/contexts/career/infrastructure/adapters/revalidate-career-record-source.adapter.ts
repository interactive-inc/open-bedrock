import type { CareerContext } from "@/contexts/career/configuration/career-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureCareerRecordAdapter } from "@/contexts/career/infrastructure/adapters/capture-career-record.adapter"
import { CareerError } from "@/contexts/career/domain/errors"
import { careerRecordKindSchema } from "@/contexts/career/domain/definitions/career-record-kind.definition"

type Context = CareerContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateCareerRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "career"
    )
      return new CareerError("forbidden", "record source does not belong to this career registry")

    const recordKind = careerRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success) return new CareerError("forbidden", "invalid career record kind")
    const current = await new CaptureCareerRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new CareerError("career_conflict", "career record differs from preservation proposal")

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
