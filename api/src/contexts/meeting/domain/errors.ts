import { DomainError } from "@system/domain/errors"

export type MeetingErrorCode = "forbidden" | "meeting_conflict" | "meeting_unavailable"

/** meeting原記録の保全操作が成立しない理由。 */
export class MeetingError extends DomainError {
  constructor(
    readonly code: MeetingErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "MeetingError"
  }
}
