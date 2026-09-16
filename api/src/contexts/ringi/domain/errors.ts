import { DomainError } from "@system/domain/errors"

export type RingiErrorCode = "forbidden" | "ringi_conflict" | "ringi_unavailable"

/** ringi原記録の保全操作が成立しない理由。 */
export class RingiError extends DomainError {
  constructor(
    readonly code: RingiErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "RingiError"
  }
}
