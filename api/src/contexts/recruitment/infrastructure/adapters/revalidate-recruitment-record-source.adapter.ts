import type { RecruitmentContext } from "@/contexts/recruitment/configuration/recruitment-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureRecruitmentRecordAdapter } from "@/contexts/recruitment/infrastructure/adapters/capture-recruitment-record.adapter"
import { RecruitmentError } from "@/contexts/recruitment/domain/errors"
import { recruitmentRecordKindSchema } from "@/contexts/recruitment/domain/definitions/recruitment-record-kind.definition"

type Context = RecruitmentContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateRecruitmentRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "recruitment"
    )
      return new RecruitmentError(
        "forbidden",
        "record source does not belong to this recruitment registry",
      )

    const recordKind = recruitmentRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success)
      return new RecruitmentError("forbidden", "invalid recruitment record kind")
    const current = await new CaptureRecruitmentRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new RecruitmentError(
        "recruitment_conflict",
        "recruitment record differs from preservation proposal",
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
