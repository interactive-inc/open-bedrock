import type { CertificationContext } from "@/contexts/certification/configuration/certification-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureCertificationRecordAdapter } from "@/contexts/certification/infrastructure/adapters/capture-certification-record.adapter"
import { CertificationError } from "@/contexts/certification/domain/errors"
import { certificationRecordKindSchema } from "@/contexts/certification/domain/definitions/certification-record-kind.definition"

type Context = CertificationContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateCertificationRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "certification"
    )
      return new CertificationError(
        "forbidden",
        "record source does not belong to this certification registry",
      )

    const recordKind = certificationRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success)
      return new CertificationError("forbidden", "invalid certification record kind")
    const current = await new CaptureCertificationRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new CertificationError(
        "certification_conflict",
        "certification record differs from preservation proposal",
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
