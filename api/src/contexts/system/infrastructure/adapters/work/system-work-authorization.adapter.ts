import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import type { AccessTokenClaims } from "@system/domain/schemas/auth/access-token-claims.schema"
import {
  systemWorkActorSchema,
  systemWorkAuthenticationSchema,
  type SystemWorkActor,
  type SystemWorkAuthentication,
} from "@system/domain/schemas/work/system-work-item.schema"
import { SystemWorkItemError } from "@system/domain/errors"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"

type Context = SystemD1Context & SystemClockContext & Readonly<{ claims: AccessTokenClaims }>
export type SystemWorkAuthorization = Readonly<{
  actor: SystemWorkActor
  authentication: SystemWorkAuthentication
  isAdmin: boolean
  permission: string
  assertions: () => ReadonlyArray<D1PreparedStatement> | SystemWorkItemError
}>
type Snapshot = Readonly<{
  principal_id: string
  kind: string
  step_up_id: string | null
  is_admin: number
  proof: string
}>
const authorized = `WITH evaluation AS (SELECT max(?3, CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at), grants AS (
  SELECT binding.id, binding.role_id, binding.created_at, binding.revoked_at, role.updated_at, permission.permission_key
  FROM system_role_bindings binding JOIN system_iam_roles role ON role.id=binding.role_id
  JOIN system_iam_role_permissions permission ON permission.role_id=role.id
  WHERE binding.account_id=?1 AND binding.resource_type IS NULL AND binding.resource_id IS NULL
    AND role.resource_type IS NULL AND role.created_at<=(SELECT at FROM evaluation) AND binding.created_at<=(SELECT at FROM evaluation)
    AND (binding.revoked_at IS NULL OR (SELECT at FROM evaluation)<binding.revoked_at) ORDER BY binding.id, permission.permission_key
)
SELECT principal.id AS principal_id, principal.kind, step_up.id AS step_up_id,
  EXISTS (SELECT 1 FROM grants WHERE permission_key='system:admin') AS is_admin,
  json_object('principal', principal.revision, 'account', account.updated_at,
    'credential', credential.updated_at, 'stepUp', step_up.last_used_at,
    'grants', (SELECT json_group_array(json_object('id',id,'role',role_id,'created',created_at,
      'revoked',revoked_at,'updated',updated_at,'permission',permission_key)) FROM grants)) AS proof
FROM system_accounts account JOIN system_principals principal ON principal.account_id=account.id
LEFT JOIN system_machine_credentials credential ON credential.id=?4 AND credential.principal_id=principal.id
LEFT JOIN system_step_up_grants step_up ON step_up.account_id=account.id AND step_up.token_hash=?6
  AND step_up.issued_at<=(SELECT at FROM evaluation) AND (SELECT at FROM evaluation)<step_up.expires_at AND step_up.revoked_at IS NULL
  AND step_up.last_used_at IS NOT NULL AND step_up.last_used_at<=(SELECT at FROM evaluation)
WHERE (SELECT at FROM evaluation)<?8 AND account.id=?1 AND account.status='active' AND account.closed_at IS NULL AND account.token_version=?2
  AND account.created_at<=(SELECT at FROM evaluation) AND principal.created_at<=(SELECT at FROM evaluation) AND principal.kind IN ('human','agent')
  AND ((principal.kind='human' AND ?4 IS NULL) OR (principal.kind='agent' AND credential.status='active'
    AND credential.revoked_at IS NULL AND credential.created_at<=?5 AND ?5<=(SELECT at FROM evaluation)
    AND credential.last_used_at>=?5 AND credential.last_used_at<=(SELECT at FROM evaluation)
    AND (credential.expires_at IS NULL OR (SELECT at FROM evaluation)<credential.expires_at)))
  AND (?6 IS NULL OR (principal.kind='human' AND step_up.id IS NOT NULL))
  AND (EXISTS (SELECT 1 FROM grants WHERE permission_key='system:admin')
    OR (EXISTS (SELECT 1 FROM grants WHERE permission_key='system:work:read')
      AND EXISTS (SELECT 1 FROM grants WHERE permission_key=?7)))`

/** 現在の主体・操作権限・再認証を固定し、保存と開示の直前にも再検査する。 */
export class SystemWorkAuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{ permission: string; stepUpToken: string | null }>,
  ): Promise<SystemWorkAuthorization | SystemWorkItemError> {
    if (!/^system:work:(read|create|perform|review|manage)$/.test(input.permission))
      return new SystemWorkItemError("forbidden")
    const hash =
      input.stepUpToken === null
        ? null
        : await new SystemPrincipalSecretService().hashRawSecret(input.stepUpToken)
    if (hash instanceof Error) return new SystemWorkItemError("forbidden", hash)
    const parameters = (now: Date) => [
      this.c.claims.sub,
      this.c.claims.ver,
      now.getTime(),
      this.c.claims.machineCredentialId ?? null,
      this.c.claims.issuedAtMs,
      hash,
      input.permission,
      this.c.claims.exp * 1000,
    ]
    const validTime = () => {
      const now = this.c.var.now().getTime()
      return (
        Number.isSafeInteger(now) &&
        now >= this.c.claims.issuedAtMs &&
        now < this.c.claims.exp * 1000 &&
        Date.now() < this.c.claims.exp * 1000
      )
    }
    if (!validTime()) return new SystemWorkItemError("forbidden")
    try {
      const snapshot = await this.c.env.DB.prepare(authorized)
        .bind(...parameters(this.c.var.now()))
        .first<Snapshot>()
      if (snapshot === null) return new SystemWorkItemError("forbidden")
      const actor = systemWorkActorSchema.safeParse({
        accountId: this.c.claims.sub,
        principalId: snapshot.principal_id,
        kind: snapshot.kind,
      })
      const authentication = systemWorkAuthenticationSchema.safeParse({
        tokenVersion: this.c.claims.ver,
        credentialId: this.c.claims.machineCredentialId ?? null,
        stepUpGrantId: snapshot.step_up_id,
      })
      if (!actor.success || !authentication.success) return new SystemWorkItemError("unavailable")
      return Object.freeze({
        actor: actor.data,
        authentication: authentication.data,
        isAdmin: snapshot.is_admin === 1,
        permission: input.permission,
        assertions: () => {
          if (!validTime()) return new SystemWorkItemError("forbidden")
          return [
            this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM (${authorized}) current
            WHERE current.principal_id=?9 AND current.kind=?10 AND current.step_up_id IS ?11
              AND current.is_admin=?12 AND current.proof=?13)
            THEN 1 ELSE json_extract('{}','work_item_authorization_changed') END AS ok`).bind(
              ...parameters(this.c.var.now()),
              snapshot.principal_id,
              snapshot.kind,
              snapshot.step_up_id,
              snapshot.is_admin,
              snapshot.proof,
            ),
          ]
        },
      })
    } catch (cause) {
      return new SystemWorkItemError("unavailable", cause)
    }
  }

  async recipient(accountId: string): Promise<SystemWorkActor | SystemWorkItemError> {
    try {
      const row =
        await this.c.env.DB.prepare(`SELECT account.id AS accountId, principal.id AS principalId, principal.kind
        FROM system_accounts account JOIN system_principals principal ON principal.account_id=account.id
        WHERE account.id=?1 AND account.status='active' AND account.closed_at IS NULL
          AND principal.kind IN ('human','agent') AND account.created_at<=?2 AND principal.created_at<=?2`)
          .bind(accountId, this.c.var.now().getTime())
          .first()
      const actor = systemWorkActorSchema.safeParse(row)
      return actor.success ? actor.data : new SystemWorkItemError("invalid")
    } catch (cause) {
      return new SystemWorkItemError("unavailable", cause)
    }
  }
}
