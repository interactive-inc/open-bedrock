import { resolveExternalAccessTokenAccount } from "@/api/http/resolve-external-access-token-account"
import type { Bindings } from "@/env"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccessTokenSecretValue } from "@system/domain/values/auth/system-access-token-secret.value"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"

export type BearerAccountResolution =
  | Readonly<{
      kind: "accepted"
      accountId: ReturnType<typeof zAccountId.parse>
      tokenVersion: number
    }>
  | Readonly<{ kind: "rejected"; reason: string }>
  | Readonly<{ kind: "unavailable" }>

async function resolveSystemSession(props: {
  token: string
  env: Bindings
  now: Date
}): Promise<BearerAccountResolution> {
  const secret = SystemAccessTokenSecretValue.create(props.env.JWT_SECRET ?? "")
  if (!(secret instanceof SystemAccessTokenSecretValue)) return { kind: "unavailable" }

  const claims = await new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).verify(
    props.token,
    secret.toString(),
    new Date(),
  )
  if (claims instanceof Error) return { kind: "rejected", reason: "invalid token" }

  const accountId = zAccountId.safeParse(claims.sub)
  if (!accountId.success) return { kind: "rejected", reason: "invalid token" }

  const authentication = await SystemAccountRepository.resolveSession({
    accountRepository: new SystemAccountRepository({ database: props.env.DB }),
    accountId: accountId.data,
    sessionTokenVersion: claims.ver,
  })
  if (authentication instanceof Error) return { kind: "unavailable" }
  if (authentication.kind === "accepted") {
    return {
      kind: "accepted",
      accountId: accountId.data,
      tokenVersion: authentication.account.tokenVersion,
    }
  }
  if (authentication.reason === "account_not_found") {
    return { kind: "rejected", reason: "account not found" }
  }
  if (authentication.reason === "account_inactive") {
    return { kind: "rejected", reason: "account is not active" }
  }
  if (authentication.reason === "token_version_mismatch") {
    return { kind: "rejected", reason: "token has been revoked" }
  }

  return { kind: "rejected", reason: "invalid token" }
}

/** Bearerを外部access tokenまたは従来System sessionとしてAccountへ解決する。 */
export async function resolveBearerAccount(props: {
  token: string
  env: Bindings
  now: Date
}): Promise<BearerAccountResolution> {
  const external = await resolveExternalAccessTokenAccount(props)
  if (external.kind === "accepted") {
    const accountId = zAccountId.safeParse(external.accountId)
    if (!accountId.success) return { kind: "rejected", reason: "invalid token" }

    return {
      kind: "accepted",
      accountId: accountId.data,
      tokenVersion: external.tokenVersion,
    }
  }
  if (external.kind === "rejected") return { kind: "rejected", reason: "invalid token" }
  if (external.kind === "unavailable") return { kind: "unavailable" }

  return await resolveSystemSession(props)
}
