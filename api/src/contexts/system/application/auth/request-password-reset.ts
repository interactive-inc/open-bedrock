import { PasswordResetRequestApplicationError } from "@/contexts/system/application/errors"
import { LoginRateLimitAdapter } from "@/contexts/system/infrastructure/adapters/auth/login-rate-limit.adapter"
import { PasswordResetEmailAdapter } from "@/contexts/system/infrastructure/adapters/auth/password-reset-email.adapter"
import { hashPasswordResetToken } from "@system/lib/auth/hash-password-reset-token"
import { generateOpaqueToken } from "@system/lib/auth/generate-opaque-token"
import { CreateSystemPasswordResetChallengeAdapter } from "@system/infrastructure/adapters/auth/create-system-password-reset-challenge.adapter"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import type {
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
  SystemEmailContext,
  SystemRequestAuditContext,
} from "@system/configuration/system-context"
type Props = Readonly<{
  email: string
  origin: string
  recipient: Readonly<{
    accountId: string
    identityId: string
    email: string
  }> | null
}>
type Context = SystemDatabaseContext &
  SystemD1Context &
  SystemClockContext &
  SystemEmailContext &
  SystemRequestAuditContext

export class RequestPasswordReset {
  static readonly featureId = "00450024"

  private readonly tokenLifetimeMilliseconds = 60 * 60 * 1000

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async accept(email: string, clientIp: string | null): Promise<boolean> {
    const rateLimitKey = LoginRateLimitAdapter.loginKey(clientIp, email)
    const rateLimit = new LoginRateLimitAdapter(this.c)

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

    const writeResult = await new CreateSystemPasswordResetChallengeAdapter(
      this.c,
    ).createSystemPasswordResetChallenge({
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

    const emailResult = await new PasswordResetEmailAdapter(this.c).send({
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
