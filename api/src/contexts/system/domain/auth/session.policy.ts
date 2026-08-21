import { readBearerAuthorization } from "@system/interface/lib/authorization/bearer-authorization"

type SessionIssuedAt = Readonly<{ iat: number | null; issuedAtMs: number | null }>

export class SessionPolicy {
  static hasBearerAuthorization(authorization: string | undefined): boolean {
    return readBearerAuthorization(authorization).kind !== "absent"
  }

  static bearerToken(authorization: string | undefined): string | undefined {
    const parsed = readBearerAuthorization(authorization)

    return parsed.kind === "token" ? parsed.token : undefined
  }

  static isRevokedByPasswordChange(
    props: Readonly<{
      issuedAtSeconds: number | null
      issuedAtMs?: number | null
      passwordChangedAt: Date | null
    }>,
  ): boolean {
    if (props.passwordChangedAt === null) {
      return false
    }

    if (props.issuedAtSeconds === null) {
      return true
    }

    if (props.issuedAtMs !== null && props.issuedAtMs !== undefined) {
      return props.issuedAtMs < props.passwordChangedAt.getTime()
    }

    return props.issuedAtSeconds <= Math.floor(props.passwordChangedAt.getTime() / 1000)
  }

  static shouldRefresh(
    props: Readonly<{ payload: SessionIssuedAt; nowMs: number; refreshAfterSeconds: number }>,
  ): boolean {
    if (props.payload.issuedAtMs !== null) {
      return props.nowMs - props.payload.issuedAtMs >= props.refreshAfterSeconds * 1000
    }

    if (props.payload.iat !== null) {
      return props.nowMs - props.payload.iat * 1000 >= props.refreshAfterSeconds * 1000
    }

    return true
  }
}
