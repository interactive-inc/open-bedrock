import { DomainError } from "@system/domain/errors"

export type CertificationErrorCode =
  | "forbidden"
  | "certification_conflict"
  | "certification_unavailable"

/** certification原記録の保全操作が成立しない理由。 */
export class CertificationError extends DomainError {
  constructor(
    readonly code: CertificationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "CertificationError"
  }
}
