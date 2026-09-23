import { DomainError } from "@system/domain/errors"

export type KnowledgeErrorCode = "forbidden" | "knowledge_conflict" | "knowledge_unavailable"

/** knowledge原記録の保全操作が成立しない理由。 */
export class KnowledgeError extends DomainError {
  constructor(
    readonly code: KnowledgeErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "KnowledgeError"
  }
}
