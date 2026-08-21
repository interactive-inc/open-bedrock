import { zAccountId, type AccountId } from "@system/domain/values/account-id.schema"
import {
  accountStatusSchema,
  type AccountStatus,
} from "@system/domain/values/account-status.schema"
import { InvalidAccountError } from "@system/domain/errors"
import { z } from "zod"

const propsSchema = z
  .object({
    id: zAccountId,
    status: accountStatusSchema,
    tokenVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/**
 * Systemの認証主体。人物・従業員・組織・credential・表示profileは所有しない。
 */
export class AccountEntity {
  readonly id: AccountId
  readonly status: AccountStatus
  readonly tokenVersion: number
  readonly #createdAtEpochMilliseconds: number
  readonly #updatedAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.status = props.status
    this.tokenVersion = props.tokenVersion
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#updatedAtEpochMilliseconds = props.updatedAt.getTime()
    Object.freeze(this)
  }

  static create(input: unknown): AccountEntity | InvalidAccountError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) {
      return new InvalidAccountError("invalid_shape", parsed.error)
    }
    if (parsed.data.updatedAt.getTime() < parsed.data.createdAt.getTime()) {
      return new InvalidAccountError("update_before_creation")
    }

    return new AccountEntity(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get updatedAt(): Date {
    return new Date(this.#updatedAtEpochMilliseconds)
  }

  activate(at: Date): AccountEntity | InvalidAccountError {
    return this.withStatus("active", at)
  }

  suspend(at: Date): AccountEntity | InvalidAccountError {
    return this.withStatus("suspended", at)
  }

  lock(at: Date): AccountEntity | InvalidAccountError {
    if (this.status === "suspended") return this.withSameState(at)

    return this.withStatus("locked", at)
  }

  invalidateSessions(at: Date): AccountEntity | InvalidAccountError {
    return this.withSecurityChange(this.status, at)
  }

  private withStatus(status: AccountStatus, at: Date): AccountEntity | InvalidAccountError {
    if (status === this.status) return this.withSameState(at)

    return this.withSecurityChange(status, at)
  }

  private withSameState(at: Date): AccountEntity | InvalidAccountError {
    const timeError = this.getTransitionTimeError(at)

    return timeError ?? this
  }

  private withSecurityChange(status: AccountStatus, at: Date): AccountEntity | InvalidAccountError {
    const timeError = this.getTransitionTimeError(at)

    if (timeError !== null) return timeError
    if (this.tokenVersion === Number.MAX_SAFE_INTEGER) {
      return new InvalidAccountError("token_version_exhausted")
    }

    return AccountEntity.create({
      ...this.toProps(),
      status,
      tokenVersion: this.tokenVersion + 1,
      updatedAt: at,
    })
  }

  private getTransitionTimeError(at: Date): InvalidAccountError | null {
    if (!Number.isFinite(at.getTime())) return new InvalidAccountError("invalid_shape")
    if (at.getTime() < this.#updatedAtEpochMilliseconds) {
      return new InvalidAccountError("transition_before_last_update")
    }

    return null
  }

  private toProps(): ParsedProps {
    return {
      id: this.id,
      status: this.status,
      tokenVersion: this.tokenVersion,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
