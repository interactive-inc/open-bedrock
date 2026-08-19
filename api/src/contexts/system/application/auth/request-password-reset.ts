import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { SecureTokenGenerator } from "@/contexts/system/infrastructure/auth/secure-token.generator"
import { PasswordResetRequestApplicationError } from "@/contexts/system/application/auth/errors"
import { PasswordResetTokenEntity } from "@/contexts/system/domain/auth/password-reset-token.entity"
import { InvalidPasswordResetTokenError } from "@/contexts/system/domain/auth/invalid-password-reset-token.error"
import { IdValue } from "@/lib/identity/id.value"
import { PasswordResetTokenWriteError } from "@/contexts/system/infrastructure/auth/errors"
import { PasswordResetTokenRepository } from "@/contexts/system/infrastructure/auth/password-reset-token.repository"
import { AuthAuditLogRepository } from "@/contexts/system/infrastructure/audit/auth-audit-log.repository"
import { LoginRateLimitService } from "@/contexts/system/infrastructure/auth/login-rate-limit.service"
import { PasswordResetEmailGateway } from "@/contexts/system/infrastructure/auth/password-reset-email.gateway"
import type {
  SystemClockContext,
  SystemDatabaseContext,
  SystemEmailContext,
} from "@system/infrastructure/configuration/system-context"
type Props = Readonly<{
  email: string
  origin: string
  recipient: Readonly<{
    userId: string
    identityId: string
    email: string
  }> | null
}>

export class RequestPasswordReset {
  static readonly featureId = "00450024"

  private readonly tokenLifetimeMilliseconds = 60 * 60 * 1000

  constructor(
    private readonly c: SystemDatabaseContext & SystemClockContext & SystemEmailContext,
  ) {}

  async accept(email: string, clientIp: string | null): Promise<boolean> {
    const rateLimitKey = LoginRateLimitService.loginKey(clientIp, email)
    const rateLimit = new LoginRateLimitService(this.c)

    if (await rateLimit.isLimited({ key: rateLimitKey })) {
      return false
    }

    await rateLimit.record({ key: rateLimitKey })
    return true
  }

  async execute(props: Props) {
    if (props.recipient === null) {
      return { ok: true as const }
    }

    const now = this.c.var.now()
    const token = PasswordResetTokenEntity.create({
      id: IdValue.create().toString(),
      token: SecureTokenGenerator.generate(),
      userId: props.recipient.userId,
      identityId: props.recipient.identityId,
      expiresAt: new Date(now.getTime() + this.tokenLifetimeMilliseconds),
      usedAt: null,
      createdAt: now,
    })

    if (token instanceof InvalidPasswordResetTokenError) {
      return new PasswordResetRequestApplicationError(token)
    }

    const writeResult = await new PasswordResetTokenRepository(this.c).write(token)

    if (writeResult instanceof PasswordResetTokenWriteError) {
      return new PasswordResetRequestApplicationError(writeResult)
    }

    const emailResult = await new PasswordResetEmailGateway(this.c).send({
      to: props.recipient.email,
      origin: props.origin,
      token: token.token,
    })

    if (emailResult instanceof Error) {
      console.error("[password-reset-email] failed to send.", emailResult)
    }

    await new AuthAuditLogRepository(this.c).write(
      WriteOperationEntity.create("record", {
        userId: props.recipient.userId,
        role: "unknown",
        action: "password-reset:request",
        resourceId: props.recipient.userId,
        metadata: { email: props.email },
      }),
    )

    return { ok: true as const }
  }
}
