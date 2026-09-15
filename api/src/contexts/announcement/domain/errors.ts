import { DomainError } from "@system/domain/errors"

export type AnnouncementErrorCode =
  | "forbidden"
  | "announcement_conflict"
  | "announcement_unavailable"

/** アナウンス原記録の保全操作が成立しない理由。 */
export class AnnouncementError extends DomainError {
  constructor(
    readonly code: AnnouncementErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "AnnouncementError"
  }
}
