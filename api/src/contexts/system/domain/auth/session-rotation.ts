import { InvalidSessionError } from "@system/domain/auth/invalid-session.error"
import { Session } from "@system/domain/auth/session.entity"

/** 旧Sessionの消費と後継Sessionの作成を不可分な永続化意図として表す。 */
export class SessionRotation {
  private constructor(
    readonly previous: Session,
    readonly successor: Session,
  ) {
    Object.freeze(this)
  }

  static create(
    current: Session,
    successor: Session,
    rotatedAt: Date,
  ): SessionRotation | InvalidSessionError {
    const rotated = current.rotate(rotatedAt)

    if (rotated instanceof InvalidSessionError) return rotated
    if (!SessionRotation.isValidSuccessor(current, successor, rotatedAt)) {
      return new InvalidSessionError("invalid_rotation_successor")
    }

    return new SessionRotation(rotated, successor)
  }

  private static isValidSuccessor(current: Session, successor: Session, rotatedAt: Date): boolean {
    return (
      successor.accountId === current.accountId &&
      successor.familyId === current.familyId &&
      successor.tokenVersion === current.tokenVersion &&
      successor.id !== current.id &&
      successor.tokenHash !== current.tokenHash &&
      successor.createdAt.getTime() === rotatedAt.getTime() &&
      successor.rotatedAt === null &&
      successor.revokedAt === null &&
      successor.getUseRejection(rotatedAt) === null
    )
  }
}
