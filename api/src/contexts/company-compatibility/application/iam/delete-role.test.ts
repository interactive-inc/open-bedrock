import { DeleteRole } from "@/contexts/company-compatibility/application/iam/delete-role"
import { RoleRepository } from "@/contexts/company-compatibility/infrastructure/iam/role-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { makeTestSession } from "@/api/test/support/make-test-session"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { ApplicationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

async function seedDynamicRole(db: D1Database, key: string): Promise<number> {
  const roleId = 999
  await db
    .prepare(
      `INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
       VALUES (?1, ?2, 'custom', ?3, 0, 0)`,
    )
    .bind(String(roleId), `company:${key}`, key)
    .run()
  return roleId
}

function seedRolePermission(db: D1Database, roleId: number, permissionKey: string): Promise<void> {
  return db
    .prepare(
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)",
    )
    .bind(String(roleId), permissionKey)
    .run()
    .then(() => undefined)
}

async function countRolePermissions(db: D1Database, roleId: number): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as cnt FROM system_iam_role_permissions WHERE role_id = ?1")
    .bind(String(roleId))
    .first()

  return (result as { cnt: number }).cnt
}

async function countRoles(db: D1Database, roleId: number): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as cnt FROM system_iam_roles WHERE id = ?1")
    .bind(String(roleId))
    .first()

  return (result as { cnt: number }).cnt
}

describe("DeleteRole", () => {
  test("role_permissions も一緒に削除されて孤立行が残らない", async () => {
    const { context, db } = createTestContext()

    const roleId = await seedDynamicRole(db, "test-role")
    await seedRolePermission(db, roleId, "dashboard:view")

    expect(await countRolePermissions(db, roleId)).toBe(1)

    const usecase = new DeleteRole(context)
    const result = await usecase.run({
      session: makeTestSession("root"),
      roleId: roleId,
    })

    expect(result).toEqual({ reason: "deleted" })
    expect(await countRolePermissions(db, roleId)).toBe(0)
    expect(await countRoles(db, roleId)).toBe(0)
  })

  test("account に割当中のロールは削除できない (role_in_use)", async () => {
    const { context, db } = createTestContext()

    const roleId = await seedDynamicRole(db, "assigned-role")

    // employee → account → account_roles を作って割当状態にする
    await db
      .prepare(
        "INSERT INTO employees (id, code, name, status) VALUES (99, 'E099', 'Test', 'active')",
      )
      .run()

    await seedIamForEmployees(db, [
      { id: 99, email: "you+e099@example.com", passwordHash: "hash", role: "member" },
    ])

    await db
      .prepare(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('assigned-test', '99', ?1, NULL, NULL, 0, NULL)`,
      )
      .bind(String(roleId))
      .run()

    const usecase = new DeleteRole(context)
    const result = await usecase.run({
      session: makeTestSession("root"),
      roleId: roleId,
    })

    expect(result).toBeInstanceOf(ApplicationError)
    expect((result as ApplicationError).code).toBe("role_in_use")

    // ロールも permission も残っていること（rollback されたこと）を確認
    expect(await countRoles(db, roleId)).toBe(1)
  })

  test("TOCTOU: 削除チェック後に割当が入っても batch で防げる", async () => {
    // このテストは batch がアトミックであることを検証する。
    // 直接 deleteWithPermissionsGuardingAssignment を呼び、
    // 割当がある状態で呼んでも正しく拒否されることを確認する。
    const { context, db } = createTestContext()

    const roleId = await seedDynamicRole(db, "race-role")
    await seedRolePermission(db, roleId, "dashboard:view")

    // employee + account を作成
    await db
      .prepare(
        "INSERT INTO employees (id, code, name, status) VALUES (88, 'E088', 'Racer', 'active')",
      )
      .run()

    await seedIamForEmployees(db, [
      { id: 88, email: "you+e088@example.com", passwordHash: "hash", role: "member" },
    ])

    // 割当を追加
    await db
      .prepare(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('race-test', '88', ?1, NULL, NULL, 0, NULL)`,
      )
      .bind(String(roleId))
      .run()

    const repo = new RoleRepository(context)
    const result = await repo.deleteWithPermissionsGuardingAssignment(roleId)

    expect(result).toBe("role_in_use")

    // batch が rollback されて role_permissions も roles も残っている
    expect(await countRolePermissions(db, roleId)).toBe(1)
    expect(await countRoles(db, roleId)).toBe(1)
  })
})
