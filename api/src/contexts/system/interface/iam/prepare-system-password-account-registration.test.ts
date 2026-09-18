import { prepareSystemPasswordAccountRegistration } from "@system/interface/iam/prepare-system-password-account-registration"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"

test("招待登録のSystem行を同じbatchで作り、Identity競合時はAccountも残さない", async () => {
  const fixture = new SystemSessionTestContext()
  const database = fixture.context.env.DB
  const prepare = (accountId: string, identityId: string, email: string) =>
    prepareSystemPasswordAccountRegistration(database, {
      accountId,
      reuseExistingAccount: false,
      identityId,
      email,
      passwordHash: "hashed-password",
      roleBindingId: `binding-${accountId}`,
      roleId: "role-1",
      resourceType: "demo:scope",
      resourceId: "resource-1",
      now: new Date(100),
    })
  const run = async (accountId: string, identityId: string, email: string) => {
    const registration = prepare(accountId, identityId, email)
    if (registration instanceof Error || registration.accountCreation === null) {
      throw new Error("Invalid registration fixture")
    }
    await drizzle(database).batch([
      registration.accountCreation,
      registration.identityCreation,
      registration.identityProfileCreation,
      registration.passwordCredentialCreation,
      registration.roleBindingCreation,
    ])
  }

  try {
    await run("usr_first", "identity-1", "person@example.com")
    expect(
      await database
        .prepare(
          "SELECT resource_type, resource_id FROM system_role_bindings WHERE account_id = 'usr_first'",
        )
        .first<{ resource_type: string; resource_id: string }>(),
    ).toEqual({ resource_type: "demo:scope", resource_id: "resource-1" })

    await expect(run("usr_second", "identity-2", "person@example.com")).rejects.toThrow()
    expect(
      await database
        .prepare("SELECT id FROM system_accounts WHERE id = 'usr_second'")
        .first<{ id: string }>(),
    ).toBeNull()
  } finally {
    fixture.sqlite.close()
  }
})
