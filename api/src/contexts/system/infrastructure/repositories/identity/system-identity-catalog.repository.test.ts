import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemIdentityCatalogRepository } from "@system/infrastructure/repositories/identity/system-identity-catalog.repository"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, test } from "bun:test"

test("Accountごとに優先する有効なIdentity emailを1件返す", async () => {
  const fixture = new SystemSessionTestContext()
  const firstAccountId = zAccountId.parse("account-first")
  const secondAccountId = zAccountId.parse("account-second")

  fixture.sqlite.exec(`
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
    VALUES
      ('account-first', 'active', 0, 1, 1),
      ('account-second', 'active', 0, 1, 1);

    INSERT INTO system_identity_bindings
      (id, account_id, provider, subject, created_at, activated_at, revoked_at)
    VALUES
      ('first-unverified', 'account-first', 'oidc', 'first-unverified', 1, 1, NULL),
      ('first-verified', 'account-first', 'password', 'first-verified', 2, 2, NULL),
      ('first-revoked', 'account-first', 'oidc', 'first-revoked', 3, 3, 4),
      ('second-active', 'account-second', 'password', 'second-active', 1, 1, NULL);

    INSERT INTO system_identity_profiles
      (identity_id, email, email_verified, can_receive_email, last_used_at, updated_at)
    VALUES
      ('first-unverified', 'unverified@example.test', 0, 1, 10, 10),
      ('first-verified', 'verified@example.test', 1, 1, 5, 5),
      ('first-revoked', 'revoked@example.test', 1, 1, 20, 20),
      ('second-active', 'second@example.test', 1, 1, 1, 1);
  `)

  const result = await new SystemIdentityCatalogRepository(
    fixture.context,
  ).primaryEmailsForAccounts([firstAccountId, secondAccountId])

  expect(result).not.toBeInstanceOf(Error)
  expect(result instanceof Error ? [] : [...result]).toEqual([
    [firstAccountId, "verified@example.test"],
    [secondAccountId, "second@example.test"],
  ])
})
