import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"

export const EFFECTIVE_ADMIN_TEST_PERMISSION_KEYS = [
  "employee:assign_role",
  "iam:manage_roles",
  "iam:assign_roles",
  "account:manage",
] as const

export async function seedIamTestAccount(
  context: Context,
  code: string,
  systemRole: string = "member",
): Promise<number> {
  const created = await new EmployeeRepository(context).create({
    code: code,
    name: "Sam Rivers",
    deptId: 3,
    deptName: "Engineering",
    position: "Engineer",
    status: "active",
  })

  if (created instanceof Error) {
    throw created
  }

  await seedIamForEmployees(context.env.DB, [
    {
      id: created.id,
      email: `you+${code.toLowerCase()}@example.com`,
      passwordHash: "hash",
      role: systemRole,
    },
  ])

  return created.id
}

export async function replaceAccountRolesWithPermissionSets(
  context: Context,
  accountId: number,
  roleKeyPrefix: string,
  permissionSets: ReadonlyArray<ReadonlyArray<string>>,
): Promise<ReadonlyArray<{ id: number; key: string }>> {
  const db = context.env.DB

  await db.prepare("DELETE FROM account_roles WHERE account_id = ?1").bind(accountId).run()

  const createdRoles: Array<{ id: number; key: string }> = []

  for (const [index, permissionKeys] of permissionSets.entries()) {
    const roleKey = `${roleKeyPrefix}-${index + 1}`
    const inserted = await db
      .prepare("INSERT INTO roles (key, name, is_system, created_at) VALUES (?1, ?1, 0, 0)")
      .bind(roleKey)
      .run()
    const roleId = inserted.meta.last_row_id

    for (const permissionKey of permissionKeys) {
      await db
        .prepare(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT ?1, id FROM permissions WHERE key = ?2`,
        )
        .bind(roleId, permissionKey)
        .run()
    }

    await db
      .prepare(
        "INSERT INTO account_roles (account_id, role_id, granted_by, granted_at) VALUES (?1, ?2, NULL, 0)",
      )
      .bind(accountId, roleId)
      .run()

    createdRoles.push({ id: roleId, key: roleKey })
  }

  return createdRoles
}
