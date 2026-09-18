import { hasSystemIdentitySubject } from "@system/interface/iam/has-system-identity-subject"
import { readSystemAccountSnapshot } from "@system/interface/iam/read-system-account-snapshot"
import { readSystemRoleRevision } from "@system/interface/iam/read-system-role-revision"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, test } from "bun:test"

test("招待登録用のSystem読取はIdentity重複、Account状態、Role版を公開する", async () => {
  const fixture = new SystemSessionTestContext()
  try {
    fixture.sqlite.run(
      "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('usr_person', 'active', 2, 100, 200)",
    )
    fixture.sqlite.run(
      "INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at, activated_at) VALUES ('identity-1', 'usr_person', 'password', 'person@example.com', 100, 100)",
    )
    fixture.sqlite.run(
      "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES ('role-1', 'demo:member', 'managed', 'demo:scope', 'Member', 100, 200)",
    )
    const database = fixture.context.env.DB

    expect(
      await hasSystemIdentitySubject(database, {
        provider: "password",
        subject: "person@example.com",
      }),
    ).toBe(true)
    expect(
      await hasSystemIdentitySubject(database, {
        provider: "password",
        subject: "other@example.com",
      }),
    ).toBe(false)
    expect(await readSystemAccountSnapshot(database, "usr_person")).toEqual({
      id: "usr_person",
      status: "active",
      tokenVersion: 2,
      closedAt: null,
      updatedAt: new Date(200),
    })
    expect(await readSystemRoleRevision(database, "role-1")).toEqual({
      id: "role-1",
      name: "Member",
      resourceType: "demo:scope",
      updatedAt: new Date(200),
    })
  } finally {
    fixture.sqlite.close()
  }
})
