import type { CertificateRequestContext } from "@/contexts/certificate-request/configuration/certificate-request-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureCertificateRequestRecordAdapter } from "@/contexts/certificate-request/infrastructure/adapters/capture-certificate-request-record.adapter"
import { CertificateRequestError } from "@/contexts/certificate-request/domain/errors"

type Context = CertificateRequestContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateCertificateRequestRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "certificate-request" ||
      source.props.recordKind !== "certificate-request-record"
    )
      return new CertificateRequestError("forbidden", "record source does not belong to this certificate-request registry")

    const current = await new CaptureCertificateRequestRecordAdapter(this.c).prepare({
      certificateRequestId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new CertificateRequestError(
        "certificate_request_conflict",
        "certificate-request record differs from preservation proposal",
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
