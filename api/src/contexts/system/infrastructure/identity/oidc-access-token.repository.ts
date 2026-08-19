import { OidcValue } from "@system/domain/identity/oidc.value"
import type { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { OidcCryptographyService } from "@/contexts/system/infrastructure/identity/oidc-cryptography.service"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import { oidcAccessTokens } from "@/contexts/system/infrastructure/schema/system-runtime"
import { and, eq, gt, lte } from "drizzle-orm"

type CreateProps = Readonly<{
  issuer: string
  clientId: string
  userId: string
  scope: string
}>

type FindProps = Readonly<{ issuer: string; accessToken: string }>

export type OidcAccessToken = Readonly<{
  clientId: string
  userId: string
  scope: string
}>

export class OidcAccessTokenRepository {
  constructor(private readonly c: SystemDatabaseContext & SystemClockContext) {}

  async write(
    entity: WriteOperationEntity<"create", CreateProps>,
  ): Promise<{ accessToken: string; expiresAt: Date } | Error> {
    const props = entity.props
    const now = this.c.var.now()
    const expiresAt = new Date(now.getTime() + OidcValue.TOKEN_MAX_AGE_MS)
    const accessToken = OidcCryptographyService.createSecret()
    const tokenHash = await OidcCryptographyService.hashSecret(accessToken)

    try {
      await this.c.var.database.delete(oidcAccessTokens).where(lte(oidcAccessTokens.expiresAt, now))

      await this.c.var.database.insert(oidcAccessTokens).values({
        tokenHash,
        issuer: props.issuer,
        clientId: props.clientId,
        userId: props.userId,
        scope: props.scope,
        expiresAt,
        createdAt: now,
      })

      return { accessToken, expiresAt }
    } catch {
      return new Error("access_token_write_failed")
    }
  }

  async find(props: FindProps): Promise<OidcAccessToken | null | Error> {
    const now = this.c.var.now()
    const tokenHash = await OidcCryptographyService.hashSecret(props.accessToken)

    try {
      const [token] = await this.c.var.database
        .select({
          clientId: oidcAccessTokens.clientId,
          userId: oidcAccessTokens.userId,
          scope: oidcAccessTokens.scope,
        })
        .from(oidcAccessTokens)
        .where(
          and(
            eq(oidcAccessTokens.tokenHash, tokenHash),
            eq(oidcAccessTokens.issuer, props.issuer),
            gt(oidcAccessTokens.expiresAt, now),
          ),
        )
        .limit(1)

      return token ?? null
    } catch {
      return new Error("access_token_read_failed")
    }
  }
}
