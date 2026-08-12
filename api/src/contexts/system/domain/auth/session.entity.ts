import { zAccountId, type AccountId } from "@system/domain/auth/account-id"
import { InvalidSessionError } from "@system/domain/auth/invalid-session.error"
import { zSessionFamilyId, type SessionFamilyId } from "@system/domain/auth/session-family-id"
import { zSessionId, type SessionId } from "@system/domain/auth/session-id"
import { zSessionTokenHash, type SessionTokenHash } from "@system/domain/auth/session-token-hash"
import { z } from "zod"

const propsSchema = z
  .object({
    id: zSessionId,
    accountId: zAccountId,
    familyId: zSessionFamilyId,
    tokenHash: zSessionTokenHash,
    tokenVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    createdAt: z.date(),
    expiresAt: z.date(),
    rotatedAt: z.date().nullable(),
    revokedAt: z.date().nullable(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

export const sessionUseRejections = Object.freeze([
  "expired",
  "invalid_clock",
  "not_yet_valid",
  "revoked",
  "rotated",
] as const)

export type SessionUseRejection = (typeof sessionUseRejections)[number]

/**
 * Accountに属する長期Session。raw tokenやtransport、業務主体・権限を所有しない。
 */
export class Session {
  readonly id: SessionId
  readonly accountId: AccountId
  readonly familyId: SessionFamilyId
  readonly tokenHash: SessionTokenHash
  readonly tokenVersion: number
  readonly #createdAtEpochMilliseconds: number
  readonly #expiresAtEpochMilliseconds: number
  readonly #rotatedAtEpochMilliseconds: number | null
  readonly #revokedAtEpochMilliseconds: number | null

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.accountId = props.accountId
    this.familyId = props.familyId
    this.tokenHash = props.tokenHash
    this.tokenVersion = props.tokenVersion
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#expiresAtEpochMilliseconds = props.expiresAt.getTime()
    this.#rotatedAtEpochMilliseconds = props.rotatedAt?.getTime() ?? null
    this.#revokedAtEpochMilliseconds = props.revokedAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): Session | InvalidSessionError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) return new InvalidSessionError("invalid_shape", parsed.error)

    const chronologyError = Session.getChronologyError(parsed.data)

    return chronologyError ?? new Session(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get expiresAt(): Date {
    return new Date(this.#expiresAtEpochMilliseconds)
  }

  get rotatedAt(): Date | null {
    return this.#rotatedAtEpochMilliseconds === null
      ? null
      : new Date(this.#rotatedAtEpochMilliseconds)
  }

  get revokedAt(): Date | null {
    return this.#revokedAtEpochMilliseconds === null
      ? null
      : new Date(this.#revokedAtEpochMilliseconds)
  }

  getUseRejection(at: Date): SessionUseRejection | null {
    const atEpochMilliseconds = at.getTime()

    if (!Number.isFinite(atEpochMilliseconds)) return "invalid_clock"
    if (atEpochMilliseconds < this.#createdAtEpochMilliseconds) return "not_yet_valid"
    if (
      this.#revokedAtEpochMilliseconds !== null &&
      atEpochMilliseconds >= this.#revokedAtEpochMilliseconds
    ) {
      return "revoked"
    }
    if (
      this.#rotatedAtEpochMilliseconds !== null &&
      atEpochMilliseconds >= this.#rotatedAtEpochMilliseconds
    ) {
      return "rotated"
    }
    if (atEpochMilliseconds >= this.#expiresAtEpochMilliseconds) return "expired"

    return null
  }

  rotate(at: Date): Session | InvalidSessionError {
    const rejection = this.getUseRejection(at)

    if (rejection !== null) return new InvalidSessionError(rejection)

    return Session.create({ ...this.toProps(), rotatedAt: at })
  }

  revoke(at: Date): Session | InvalidSessionError {
    if (this.#revokedAtEpochMilliseconds !== null) {
      const timeError = this.getTransitionTimeError(at, this.#revokedAtEpochMilliseconds)

      return timeError ?? this
    }

    return Session.create({ ...this.toProps(), revokedAt: at })
  }

  private static getChronologyError(props: ParsedProps): InvalidSessionError | null {
    const createdAt = props.createdAt.getTime()
    const expiresAt = props.expiresAt.getTime()
    const rotatedAt = props.rotatedAt?.getTime() ?? null
    const revokedAt = props.revokedAt?.getTime() ?? null

    if (expiresAt <= createdAt) return new InvalidSessionError("expiration_not_after_creation")
    if (rotatedAt !== null && rotatedAt < createdAt) {
      return new InvalidSessionError("rotation_before_creation")
    }
    if (rotatedAt !== null && rotatedAt >= expiresAt) {
      return new InvalidSessionError("rotation_at_or_after_expiration")
    }
    if (revokedAt !== null && revokedAt < createdAt) {
      return new InvalidSessionError("revocation_before_creation")
    }
    if (rotatedAt !== null && revokedAt !== null && revokedAt < rotatedAt) {
      return new InvalidSessionError("revocation_before_rotation")
    }

    return null
  }

  private getTransitionTimeError(at: Date, earliest: number): InvalidSessionError | null {
    if (!Number.isFinite(at.getTime())) return new InvalidSessionError("invalid_clock")
    if (at.getTime() < earliest) {
      return new InvalidSessionError("transition_before_last_update")
    }

    return null
  }

  private toProps(): ParsedProps {
    return {
      id: this.id,
      accountId: this.accountId,
      familyId: this.familyId,
      tokenHash: this.tokenHash,
      tokenVersion: this.tokenVersion,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      rotatedAt: this.rotatedAt,
      revokedAt: this.revokedAt,
    }
  }
}
