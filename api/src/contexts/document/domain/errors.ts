import { DomainError } from "@system/domain/errors"

export type DocumentErrorCode = "forbidden" | "document_conflict" | "document_unavailable"

/** document原記録の保全操作が成立しない理由。 */
export class DocumentError extends DomainError {
  constructor(
    readonly code: DocumentErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "DocumentError"
  }
}
