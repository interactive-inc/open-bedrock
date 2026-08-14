import { RoleRepository } from "@/contexts/company/infrastructure/iam/role-repository"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import { describe, expect, test } from "bun:test"

function seedDynamicRole(db: D1Database, key: string): Promise<number> {
  return db
    .prepare("INSERT INTO roles (key, name, is_system, created_at) VALUES (?1, ?2, 0, 0)")
    .bind(key, key)
    .run()
    .then((result) => result.meta.last_row_id)
}

async function getPermissionIds(
  db: D1Database,
  keys: ReadonlyArray<string>,
): Promise<ReadonlyArray<number>> {
  const results: number[] = []

  for (const key of keys) {
    const row = await db.prepare("SELECT id FROM permissions WHERE key = ?1").bind(key).first()

    if (row !== null) {
      results.push((row as { id: number }).id)
    }
  }

  return results
}

async function countRolePermissions(db: D1Database, roleId: number): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as cnt FROM role_permissions WHERE role_id = ?1")
    .bind(roleId)
    .first()

  return (result as { cnt: number }).cnt
}

async function getRolePermissionKeys(db: D1Database, roleId: number): Promise<string[]> {
  const rows = await db
    .prepare(
      "SELECT p.key FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?1",
    )
    .bind(roleId)
    .all()

  return rows.results.map((row) => (row as { key: string }).key)
}

describe("RoleRepository.replacePermissions", () => {
  test("DELETE と INSERT が同一 batch で実行され、権限が正しく置換される", async () => {
    const { context, db } = createTestContext()
    const repo = new RoleRepository(context)

    const roleId = await seedDynamicRole(db, "batch-replace-role")
    const [permId] = await getPermissionIds(db, ["dashboard:view"])

    // 初期権限を設定
    await db
      .prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?1, ?2)")
      .bind(roleId, permId)
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
    const [permId] = await getPermissionIds(db, ["dashboard:view"])

    await db
      .prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?1, ?2)")
      .bind(roleId, permId)
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
