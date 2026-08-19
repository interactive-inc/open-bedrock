import { RoleRepository } from "@/contexts/company/infrastructure/iam/role-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
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

async function countRolePermissions(db: D1Database, roleId: number): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as cnt FROM system_iam_role_permissions WHERE role_id = ?1")
    .bind(String(roleId))
    .first()

  return (result as { cnt: number }).cnt
}

async function getRolePermissionKeys(db: D1Database, roleId: number): Promise<string[]> {
  const rows = await db
    .prepare("SELECT permission_key AS key FROM system_iam_role_permissions WHERE role_id = ?1")
    .bind(String(roleId))
    .all()

  return rows.results.map((row) => (row as { key: string }).key)
}

describe("RoleRepository.replacePermissions", () => {
  test("DELETE と INSERT が同一 batch で実行され、権限が正しく置換される", async () => {
    const { context, db } = createTestContext()
    const repo = new RoleRepository(context)

    const roleId = await seedDynamicRole(db, "batch-replace-role")
    // 初期権限を設定
    await db
      .prepare("INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)")
      .bind(String(roleId), "dashboard:view")
      .run()

    expect(await countRolePermissions(db, roleId)).toBe(1)

    // 権限を置換（別の権限に変更）
    const result = await repo.replacePermissions(roleId, ["employee:read", "employee:create"])

    expect(result).toBeNull()

    const keys = await getRolePermissionKeys(db, roleId)

    expect(keys).toContain("employee:read")
    expect(keys).toContain("employee:create")
    expect(keys).not.toContain("dashboard:view")
  })

  test("空の権限リストで呼ぶと既存権限が全て削除される", async () => {
    const { context, db } = createTestContext()
    const repo = new RoleRepository(context)

    const roleId = await seedDynamicRole(db, "empty-replace-role")
    await db
      .prepare("INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)")
      .bind(String(roleId), "dashboard:view")
      .run()

    const result = await repo.replacePermissions(roleId, [])

    expect(result).toBeNull()
    expect(await countRolePermissions(db, roleId)).toBe(0)
  })

  test("存在しない permission key は無視される（DELETE は実行されるが INSERT はスキップ）", async () => {
    const { context, db } = createTestContext()
    const repo = new RoleRepository(context)

    const roleId = await seedDynamicRole(db, "nonexist-perm-role")

    const result = await repo.replacePermissions(roleId, ["nonexistent:permission"])

    expect(result).toBeNull()
    expect(await countRolePermissions(db, roleId)).toBe(0)
  })
})
