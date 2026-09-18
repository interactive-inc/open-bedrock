import { hasSystemIdentitySubject } from "@system/interface/iam/has-system-identity-subject"
import { readSystemAccountSnapshot } from "@system/interface/iam/read-system-account-snapshot"
import { readSystemRoleRevision } from "@system/interface/iam/read-system-role-revision"
import { readSystemRoleGrants } from "@system/interface/iam/read-system-role-grants"
import { readSystemIdentityEmailEligibility } from "@system/interface/iam/read-system-identity-email-eligibility"
import { readSystemRoleBindingGrants } from "@system/interface/iam/read-system-role-binding-grants"
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

test("招待作成用のSystem読取はRole権限とIdentityの受信可否を返す", async () => {
  const fixture = new SystemSessionTestContext()
  try {
    fixture.sqlite.run(
      "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('usr_person', 'active', 0, 100, 100)",
    )
    fixture.sqlite.run(
      "INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at) VALUES ('identity-1', 'usr_person', 'password', 'person@example.com', 100)",
    )
    fixture.sqlite.run(
      "INSERT INTO system_identity_profiles (identity_id, can_receive_email, updated_at) VALUES ('identity-1', 0, 100)",
    )
    fixture.sqlite.run(
      "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES ('role-1', 'legacy', 'managed', 'demo:scope', 'Member', 100, 100), ('role-2', 'legacy-2', 'managed', NULL, 'Other', 100, 100)",
    )
    fixture.sqlite.run(
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('role-1', 'demo:write'), ('role-1', 'demo:read')",
    )
    fixture.sqlite.run(
      "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('binding-1', 'usr_person', 'role-1', 100), ('binding-2', 'usr_person', 'role-2', 100)",
    )
    const database = fixture.context.env.DB

    expect(await readSystemRoleGrants(database, "role-1")).toEqual({
      resourceType: "demo:scope",
      permissionKeys: ["demo:read", "demo:write"],
    })
    expect(await readSystemRoleGrants(database, "role-2")).toEqual({
      resourceType: null,
      permissionKeys: [],
    })
    expect(await readSystemRoleGrants(database, "missing")).toBeNull()
    expect(await readSystemRoleBindingGrants(database, "binding-1")).toEqual([
      "demo:read",
      "demo:write",
    ])
    expect(await readSystemRoleBindingGrants(database, "binding-2")).toEqual([])
    expect(await readSystemRoleBindingGrants(database, "missing")).toEqual([])
    expect(
      await readSystemIdentityEmailEligibility(database, {
        provider: "password",
        subject: "person@example.com",
      }),
    ).toBe(false)
    expect(
      await readSystemIdentityEmailEligibility(database, {
        provider: "password",
        subject: "missing@example.com",
      }),
    ).toBeNull()
    fixture.sqlite.run("DELETE FROM system_identity_profiles WHERE identity_id = 'identity-1'")
    expect(
      await readSystemIdentityEmailEligibility(database, {
        provider: "password",
        subject: "person@example.com",
      }),
    ).toBeNull()
  } finally {
    fixture.sqlite.close()
  }
})
