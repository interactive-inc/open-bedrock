import { DeleteRole } from "@/contexts/company/application/iam/delete-role"
import { RoleRepository } from "@/contexts/company/infrastructure/iam/role-repository"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import { makeTestSession } from "@/contexts/company/interface/test-helpers/make-test-session"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { ApplicationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

function seedDynamicRole(db: D1Database, key: string): Promise<number> {
  return db
    .prepare("INSERT INTO roles (key, name, is_system, created_at) VALUES (?1, ?2, 0, 0)")
    .bind(key, key)
    .run()
    .then((result) => result.meta.last_row_id)
}

function seedRolePermission(db: D1Database, roleId: number, permissionId: number): Promise<void> {
  return db
    .prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?1, ?2)")
    .bind(roleId, permissionId)
    .run()
    .then(() => undefined)
}

async function getPermissionId(db: D1Database, key: string): Promise<number> {
  const result = await db.prepare("SELECT id FROM permissions WHERE key = ?1").bind(key).first()

  return (result as { id: number }).id
}

async function countRolePermissions(db: D1Database, roleId: number): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as cnt FROM role_permissions WHERE role_id = ?1")
    .bind(roleId)
    .first()

  return (result as { cnt: number }).cnt
}

async function countRoles(db: D1Database, roleId: number): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as cnt FROM roles WHERE id = ?1")
    .bind(roleId)
    .first()

  return (result as { cnt: number }).cnt
}

describe("DeleteRole", () => {
  test("role_permissions も一緒に削除されて孤立行が残らない", async () => {
    const { context, db } = createTestContext()

    const roleId = await seedDynamicRole(db, "test-role")
    const permId = await getPermissionId(db, "dashboard:view")

    await seedRolePermission(db, roleId, permId)

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
        "INSERT INTO account_roles (account_id, role_id, granted_by, granted_at) VALUES (99, ?1, NULL, 0)",
      )
      .bind(roleId)
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
    const permId = await getPermissionId(db, "dashboard:view")

    await seedRolePermission(db, roleId, permId)

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
        "INSERT INTO account_roles (account_id, role_id, granted_by, granted_at) VALUES (88, ?1, NULL, 0)",
      )
      .bind(roleId)
      .run()

    const repo = new RoleRepository(context)
    const result = await repo.deleteWithPermissionsGuardingAssignment(roleId)

    expect(result).toBe("role_in_use")

    // batch が rollback されて role_permissions も roles も残っている
    expect(await countRolePermissions(db, roleId)).toBe(1)
    expect(await countRoles(db, roleId)).toBe(1)
  })
})
