import { DomainError } from "@system/domain/errors"

export type PartnerErrorCode = "forbidden" | "partner_conflict" | "partner_unavailable"

/** partner原記録の保全操作が成立しない理由。 */
export class PartnerError extends DomainError {
  constructor(
    readonly code: PartnerErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "PartnerError"
  }
}
