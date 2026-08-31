import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import type { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"

/** HTTP testで明示的なstep-up境界を通すための短命grantをseedする。 */
export async function seedSystemStepUpGrant(
  fixture: Pick<SystemSessionTestContext, "sqlite">,
  accountId: AccountId,
  now: Date,
): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accountId))
  const rawToken = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
  const tokenHash = await new SystemPrincipalSecretService().hashRawSecret(rawToken)
  if (tokenHash instanceof Error) throw tokenHash
  fixture.sqlite
    .query(
      `INSERT INTO system_step_up_grants
         (id, account_id, token_hash, method, issued_at, expires_at, last_used_at, revoked_at)
       VALUES (?1, ?2, ?3, 'password', ?4, ?5, NULL, NULL)`,
    )
    .run(`step-up:${accountId}`, accountId, tokenHash, now.getTime(), now.getTime() + 300_000)
  return rawToken
}
