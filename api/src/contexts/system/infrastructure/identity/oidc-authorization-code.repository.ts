import { OidcValue } from "@system/domain/identity/oidc.value"
import type { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { OidcCryptographyService } from "@/contexts/system/infrastructure/identity/oidc-cryptography.service"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import { oidcAuthorizationCodes } from "@/contexts/system/infrastructure/schema/system-runtime"
import { and, eq, gt, lte } from "drizzle-orm"

type CreateProps = Readonly<{
  issuer: string
  clientId: string
  redirectUri: string
  userId: string
  codeChallenge: string
  nonce: string
  scope: ReadonlyArray<string>
}>

type ConsumeProps = Readonly<{
  issuer: string
  clientId: string
  redirectUri: string
  code: string
  verifier: string
}>

export type ConsumedAuthorizationCode = Readonly<{
  userId: string
  nonce: string
  scope: string
}>

export class OidcAuthorizationCodeRepository {
  constructor(private readonly c: SystemDatabaseContext & SystemClockContext) {}

  async write(
    entity: WriteOperationEntity<"create", CreateProps>,
  ): Promise<{ code: string; expiresAt: Date } | Error>
  async write(
    entity: WriteOperationEntity<"consume", ConsumeProps>,
  ): Promise<ConsumedAuthorizationCode | null | Error>
  async write(
    entity:
      | WriteOperationEntity<"create", CreateProps>
      | WriteOperationEntity<"consume", ConsumeProps>,
  ) {
    return entity.operation === "create"
      ? this.writeCode(entity.props)
      : this.consumeCode(entity.props)
  }

  private async writeCode(props: CreateProps): Promise<{ code: string; expiresAt: Date } | Error> {
    const now = this.c.var.now()
    const expiresAt = new Date(now.getTime() + OidcValue.AUTHORIZATION_CODE_MAX_AGE_MS)
    const code = OidcCryptographyService.createSecret()
    const codeHash = await OidcCryptographyService.hashSecret(code)

    try {
      await this.c.var.database
        .delete(oidcAuthorizationCodes)
        .where(lte(oidcAuthorizationCodes.expiresAt, now))

      await this.c.var.database.insert(oidcAuthorizationCodes).values({
        codeHash,
        issuer: props.issuer,
        clientId: props.clientId,
        redirectUri: props.redirectUri,
        userId: props.userId,
        codeChallenge: props.codeChallenge,
        nonce: props.nonce,
        scope: props.scope.join(" "),
        expiresAt,
        createdAt: now,
      })

      return { code, expiresAt }
    } catch {
      return new Error("authorization_code_write_failed")
    }
  }

  /** PKCE条件をDELETEに含め、並行交換でも一度だけ消費する。 */
  private async consumeCode(
    props: ConsumeProps,
  ): Promise<ConsumedAuthorizationCode | null | Error> {
    const now = this.c.var.now()
    const [codeHash, challenge] = await Promise.all([
      OidcCryptographyService.hashSecret(props.code),
      OidcCryptographyService.createPkceChallenge(props.verifier),
    ])

    try {
      const consumed = await this.c.var.database
        .delete(oidcAuthorizationCodes)
        .where(
          and(
            eq(oidcAuthorizationCodes.codeHash, codeHash),
            eq(oidcAuthorizationCodes.issuer, props.issuer),
            eq(oidcAuthorizationCodes.clientId, props.clientId),
            eq(oidcAuthorizationCodes.redirectUri, props.redirectUri),
            eq(oidcAuthorizationCodes.codeChallenge, challenge),
            gt(oidcAuthorizationCodes.expiresAt, now),
          ),
        )
        .returning({
          userId: oidcAuthorizationCodes.userId,
          nonce: oidcAuthorizationCodes.nonce,
          scope: oidcAuthorizationCodes.scope,
        })

      return consumed[0] ?? null
    } catch {
      return new Error("authorization_code_consume_failed")
    }
  }
}
