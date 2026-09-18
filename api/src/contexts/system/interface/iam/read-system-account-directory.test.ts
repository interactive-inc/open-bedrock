import { readSystemAccountDirectory } from "@system/interface/iam/read-system-account-directory"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, test } from "bun:test"

test("System Account directoryは外部IdPを含む有効IdentityとAccount状態を返す", async () => {
  const fixture = new SystemSessionTestContext()
  try {
    fixture.sqlite.run(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES
       ('active-account', 'active', 0, 0, 100),
       ('suspended-account', 'suspended', 0, 0, 150),
       ('no-identity', 'active', 0, 0, 0)`,
    )
    fixture.sqlite.run(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at) VALUES
       ('google-active', 'active-account', 'google', 'google-subject', 0, 1, NULL),
       ('password-revoked', 'active-account', 'password', 'password-subject', 0, 1, 50),
       ('oidc-pending', 'suspended-account', 'oidc', 'oidc-subject', 0, NULL, NULL)`,
    )
    fixture.sqlite.run(
      `INSERT INTO system_identity_profiles (identity_id, email, updated_at) VALUES
       ('google-active', 'active@example.test', 10),
       ('password-revoked', 'revoked@example.test', 10),
       ('oidc-pending', 'pending@example.test', 10)`,
    )

    const result = await readSystemAccountDirectory({
      database: fixture.context.env.DB,
      accountIds: [
        "active-account",
        "suspended-account",
        "no-identity",
        "missing",
        "active-account",
      ],
    })
    expect(result).toEqual([
      {
        id: "active-account",
        status: "active",
        updatedAt: new Date(100),
        hasLoginIdentity: true,
        email: "active@example.test",
      },
      {
        id: "no-identity",
        status: "active",
        updatedAt: new Date(0),
        hasLoginIdentity: false,
        email: null,
      },
      {
        id: "suspended-account",
        status: "suspended",
        updatedAt: new Date(150),
        hasLoginIdentity: false,
        email: null,
      },
    ])
  } finally {
    fixture.sqlite.close()
  }
})
