import { DomainError } from "@system/domain/errors"

export type RoomErrorCode = "forbidden" | "room_conflict" | "room_unavailable"

/** room原記録の保全操作が成立しない理由。 */
export class RoomError extends DomainError {
  constructor(
    readonly code: RoomErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "RoomError"
  }
}
