import { DomainError } from "@system/domain/errors"

export type CertificateRequestErrorCode =
  | "forbidden"
  | "certificate_request_conflict"
  | "certificate_request_unavailable"

/** certificate request原記録の保全操作が成立しない理由。 */
export class CertificateRequestError extends DomainError {
  constructor(
    readonly code: CertificateRequestErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "CertificateRequestError"
  }
}
