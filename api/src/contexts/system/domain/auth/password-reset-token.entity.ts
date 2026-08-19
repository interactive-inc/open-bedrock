import { InvalidPasswordResetTokenError } from "@/contexts/system/domain/auth/invalid-password-reset-token.error"
import { z } from "zod"

const zProps = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  userId: z.string().min(1),
  identityId: z.string().min(1),
  expiresAt: z.date(),
  usedAt: z.date().nullable(),
  createdAt: z.date(),
})

export type PasswordResetTokenProps = Readonly<z.input<typeof zProps>>

export class PasswordResetTokenEntity {
  readonly id: string
  readonly token: string
  readonly userId: string
  readonly identityId: string
  readonly expiresAt: Date
  readonly usedAt: Date | null
  readonly createdAt: Date

  private constructor(props: PasswordResetTokenProps) {
    const parsed = zProps.parse(props)

    this.id = parsed.id
    this.token = parsed.token
    this.userId = parsed.userId
    this.identityId = parsed.identityId
    this.expiresAt = new Date(parsed.expiresAt.getTime())
    this.usedAt = parsed.usedAt === null ? null : new Date(parsed.usedAt.getTime())
    this.createdAt = new Date(parsed.createdAt.getTime())
    Object.freeze(this)
  }

  static create(
    props: PasswordResetTokenProps,
  ): PasswordResetTokenEntity | InvalidPasswordResetTokenError {
    const parsed = zProps.safeParse(props)

    if (!parsed.success) {
      return new InvalidPasswordResetTokenError(parsed.error)
    }

    return new PasswordResetTokenEntity(parsed.data)
  }
}
