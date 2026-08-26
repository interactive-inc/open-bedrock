import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"
import { SystemAccountCatalogRepository } from "@system/infrastructure/repositories/iam/system-account-catalog.repository"
import { SystemRoleBindingRepository } from "@system/infrastructure/repositories/iam/system-role-binding.repository"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, test } from "bun:test"

/**
 * last-root guardはbatch内でUPDATEの「後ろ」に置かれたpost-state checkであり、
 * 「active rootが1人でも残っているか」を見る。評価時点で対象行は既に変更済みなので、
 * role binding削除経路のotherActiveRootCount（更新「前」に自分以外を数える）と違い、
 * EXISTS側から対象自身を除外しない。除外すると二重に引いて保護が壊れる。
 * ここではその等価性を、対象を除外しないまま最後の1人が守られることで固定する。
 */

const now = new Date("2026-01-01T00:00:00.000Z")
const rootAccountId = zAccountId.parse("system-guard-root")
const secondRootAccountId = zAccountId.parse("system-guard-root-2")
const actorAccountId = zAccountId.parse("system-guard-actor")

function createRootRole(): IamRoleEntity {
  const role = IamRoleEntity.create({
    id: "root-role",
    key: "system:root",
    kind: "managed",
    name: "System root",
    description: null,
    permissionKeys: ["iam:read", "iam:write", "system:admin"],
    createdAt: now,
    updatedAt: now,
  })
  if (role instanceof Error) throw role

  return role
}

function createFixture(): SystemSessionTestContext {
  const fixture = new SystemSessionTestContext()
  fixture.sqlite
    .query(
      `INSERT INTO system_iam_roles
         (id, key, kind, name, description, created_at, updated_at)
       VALUES ('root-role', 'system:root', 'managed', 'System root', NULL, ?1, ?1)`,
    )
    .run(now.getTime())
  fixture.sqlite
    .query(
      `INSERT INTO system_iam_role_permissions (role_id, permission_key)
       VALUES ('root-role', 'iam:read'), ('root-role', 'iam:write'), ('root-role', 'system:admin')`,
    )
    .run()

  return fixture
}

/** activeなaccount・activated identity・global root bindingの3点を揃えてrootを作る。 */
function insertRoot(
  fixture: SystemSessionTestContext,
  accountId: string,
  suffix: string,
  options?: Readonly<{ activatedIdentity?: boolean }>,
): void {
  fixture.sqlite
    .query(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`,
    )
    .run(accountId, now.getTime())
  fixture.sqlite
    .query(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES (?1, ?2, 'password', ?3, ?4, ?5, NULL)`,
    )
    .run(
      `identity-${suffix}`,
      accountId,
      `${suffix}@example.com`,
      now.getTime(),
      options?.activatedIdentity === false ? null : now.getTime(),
    )
  fixture.sqlite
    .query(
      `INSERT INTO system_role_bindings
         (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
       VALUES (?1, ?2, 'root-role', NULL, NULL, ?3, NULL)`,
    )
    .run(`binding-${suffix}`, accountId, now.getTime())
}

function readBinding(
  fixture: SystemSessionTestContext,
  bindingId: string,
): RoleBindingEntity | Error {
  return RoleBindingEntity.create({
    id: bindingId,
    accountId:
      fixture.sqlite
        .query<{ account_id: string }, [string]>(
          "SELECT account_id FROM system_role_bindings WHERE id = ?1",
        )
        .get(bindingId)?.account_id ?? "",
    roleId: "root-role",
    resource: null,
    createdAt: now,
    revokedAt: null,
  })
}

describe("System role binding last-root guard", () => {
  test("最後のrootのbindingは、対象を除外しないpost-state checkで守られる", async () => {
    const fixture = createFixture()
    insertRoot(fixture, rootAccountId, "root")
    // actorはrootではないがiam:writeを持たないので、system:adminを持つ別rootを立てて
    // actor≠targetにする。actorのidentityは未activateなので「残存するroot」に数えられない。
    insertRoot(fixture, actorAccountId, "actor", { activatedIdentity: false })

    const binding = readBinding(fixture, "binding-root")
    expect(binding).not.toBeInstanceOf(Error)
    if (binding instanceof Error) return

    const repository = new SystemRoleBindingRepository(fixture.context)
    const revocation = await repository.revoke(actorAccountId, createRootRole(), binding, now, [])

    // actor≠targetなので自己チェックは通り、last-root guardが409相当で止める。
    expect(revocation).toBe("last_root")
    // rollbackにより、bindingもtoken_versionも巻き戻っている。
    expect(
      fixture.sqlite
        .query("SELECT revoked_at FROM system_role_bindings WHERE id = 'binding-root'")
        .get(),
    ).toEqual({ revoked_at: null })
    expect(
      fixture.sqlite
        .query("SELECT token_version FROM system_accounts WHERE id = ?1")
        .get(rootAccountId),
    ).toEqual({ token_version: 0 })
  })

  test("rootが2人いるとき、1人のbindingは失効できる", async () => {
    const fixture = createFixture()
    insertRoot(fixture, rootAccountId, "root")
    insertRoot(fixture, secondRootAccountId, "root2")

    const binding = readBinding(fixture, "binding-root")
    expect(binding).not.toBeInstanceOf(Error)
    if (binding instanceof Error) return

    const repository = new SystemRoleBindingRepository(fixture.context)
    const revocation = await repository.revoke(
      secondRootAccountId,
      createRootRole(),
      binding,
      now,
      [],
    )

    expect(revocation).toBe("revoked")
    expect(
      fixture.sqlite
        .query("SELECT revoked_at FROM system_role_bindings WHERE id = 'binding-root'")
        .get(),
    ).toEqual({ revoked_at: now.getTime() })
  })

  test("最後のrootでも、自分以外のbindingの失効は通る（過剰に締めていない）", async () => {
    const fixture = createFixture()
    insertRoot(fixture, rootAccountId, "root")
    // targetはrootではない一般accountなので、失効してもrootは減らない。
    fixture.sqlite
      .query(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`,
      )
      .run(secondRootAccountId, now.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_iam_roles
           (id, key, kind, name, description, created_at, updated_at)
         VALUES ('reader-role', 'system:reader', 'custom', 'Reader', NULL, ?1, ?1)`,
      )
      .run(now.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('reader-role', 'iam:read')`,
      )
      .run()
    fixture.sqlite
      .query(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('binding-reader', ?1, 'reader-role', NULL, NULL, ?2, NULL)`,
      )
      .run(secondRootAccountId, now.getTime())

    const binding = RoleBindingEntity.create({
      id: "binding-reader",
      accountId: secondRootAccountId,
      roleId: "reader-role",
      resource: null,
      createdAt: now,
      revokedAt: null,
    })
    expect(binding).not.toBeInstanceOf(Error)
    if (binding instanceof Error) return

    const readerRole = IamRoleEntity.create({
      id: "reader-role",
      key: "system:reader",
      kind: "custom",
      name: "Reader",
      description: null,
      permissionKeys: ["iam:read"],
      createdAt: now,
      updatedAt: now,
    })
    expect(readerRole).not.toBeInstanceOf(Error)
    if (readerRole instanceof Error) return

    const repository = new SystemRoleBindingRepository(fixture.context)
    const revocation = await repository.revoke(rootAccountId, readerRole, binding, now, [])

    expect(revocation).toBe("revoked")
  })

  test("自分のbindingの失効は、rootが複数いても拒否される", async () => {
    const fixture = createFixture()
    insertRoot(fixture, rootAccountId, "root")
    insertRoot(fixture, secondRootAccountId, "root2")

    const binding = readBinding(fixture, "binding-root")
    expect(binding).not.toBeInstanceOf(Error)
    if (binding instanceof Error) return

    const repository = new SystemRoleBindingRepository(fixture.context)
    // rootが2人いるのでlast-root guardは発火しない。自己チェックだけが理由で止まる。
    const revocation = await repository.revoke(rootAccountId, createRootRole(), binding, now, [])

    expect(revocation).toBe("forbidden")
    expect(
      fixture.sqlite
        .query("SELECT revoked_at FROM system_role_bindings WHERE id = 'binding-root'")
        .get(),
    ).toEqual({ revoked_at: null })
  })
})

describe("System account last-root guard", () => {
  test("最後のrootのsuspendは、対象を除外しないpost-state checkで守られる", async () => {
    const fixture = createFixture()
    insertRoot(fixture, rootAccountId, "root")
    insertRoot(fixture, actorAccountId, "actor", { activatedIdentity: false })

    const repository = new SystemAccountCatalogRepository(fixture.context)
    const update = await repository.setStatus(actorAccountId, rootAccountId, "suspended", now, [])

    expect(update).toBe("last_root")
    expect(
      fixture.sqlite.query("SELECT status FROM system_accounts WHERE id = ?1").get(rootAccountId),
    ).toEqual({ status: "active" })
  })

  test("rootが2人いるとき、1人のsuspendは通る", async () => {
    const fixture = createFixture()
    insertRoot(fixture, rootAccountId, "root")
    insertRoot(fixture, secondRootAccountId, "root2")

    const repository = new SystemAccountCatalogRepository(fixture.context)
    const update = await repository.setStatus(
      secondRootAccountId,
      rootAccountId,
      "suspended",
      now,
      [],
    )

    expect(update).toBe("updated")
    expect(
      fixture.sqlite.query("SELECT status FROM system_accounts WHERE id = ?1").get(rootAccountId),
    ).toEqual({ status: "suspended" })
  })

  test("自分のsuspendは、rootが複数いても拒否される", async () => {
    const fixture = createFixture()
    insertRoot(fixture, rootAccountId, "root")
    insertRoot(fixture, secondRootAccountId, "root2")

    const repository = new SystemAccountCatalogRepository(fixture.context)
    const update = await repository.setStatus(rootAccountId, rootAccountId, "suspended", now, [])

    expect(update).toBe("forbidden")
    expect(
      fixture.sqlite.query("SELECT status FROM system_accounts WHERE id = ?1").get(rootAccountId),
    ).toEqual({ status: "active" })
  })
})
