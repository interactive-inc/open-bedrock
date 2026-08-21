import { PasswordResetRequestApplicationError } from "@/contexts/system/application/auth/errors"
import { LoginRateLimitService } from "@/contexts/system/infrastructure/auth/login-rate-limit.service.repository"
import { PasswordResetEmailGateway } from "@/contexts/system/infrastructure/auth/password-reset-email.gateway.repository"
import { hashPasswordResetToken } from "@system/infrastructure/auth/hash-password-reset-token.repository"
import { generateOpaqueToken } from "@system/infrastructure/auth/generate-opaque-token.repository"
import { createSystemPasswordResetChallenge } from "@system/infrastructure/auth/create-system-password-reset-challenge.repository"
import { StableSystemAuditJsonValue } from "@system/domain/values/stable-system-audit-json.value"
import type {
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
  SystemEmailContext,
  SystemRequestAuditContext,
} from "@system/infrastructure/configuration/system-context.repository"
type Props = Readonly<{
  email: string
  origin: string
  recipient: Readonly<{
    accountId: string
    identityId: string
    email: string
  }> | null
}>

export class RequestPasswordReset {
  static readonly featureId = "00450024"

  private readonly tokenLifetimeMilliseconds = 60 * 60 * 1000

  constructor(
    private readonly c: SystemDatabaseContext &
      SystemD1Context &
      SystemClockContext &
      SystemEmailContext &
      SystemRequestAuditContext,
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
    const rawToken = generateOpaqueToken()
    const tokenHash = await hashPasswordResetToken(rawToken)
    if (tokenHash instanceof Error) return new PasswordResetRequestApplicationError(tokenHash)
    const metadataJson = StableSystemAuditJsonValue.create({
      client_ip: this.c.var.auditContext.clientIp,
      client_name: this.c.var.auditContext.clientName,
      request_id: this.c.var.auditContext.requestId,
    })
    if (metadataJson instanceof Error) return new PasswordResetRequestApplicationError(metadataJson)

    const writeResult = await createSystemPasswordResetChallenge(this.c, {
      actorAccountId: null,
      id: crypto.randomUUID(),
      tokenHash,
      accountId: props.recipient.accountId,
      identityId: props.recipient.identityId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.tokenLifetimeMilliseconds),
      metadataJson: metadataJson?.toString() ?? null,
    })
    if (writeResult instanceof Error) return new PasswordResetRequestApplicationError(writeResult)

    const emailResult = await new PasswordResetEmailGateway(this.c).send({
      to: props.recipient.email,
      origin: props.origin,
      token: rawToken,
    })

    if (emailResult instanceof Error) {
      console.error("[password-reset-email] failed to send.", emailResult)
    }

    return { ok: true as const }
  }
}
