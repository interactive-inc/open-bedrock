import { Session } from "@/lib/auth/session"
import { RegisterEmployee } from "@/application/employee/register-employee"
import type { Context } from "@/env"
import { AccountAuthRepository } from "@/infrastructure/auth/account-auth-repository"
import { RoleRepository } from "@/infrastructure/iam/role-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { expectApplicationError } from "@/interface/test-helpers/expect-application-error"
import { replaceAccountRolesWithPermissionSets } from "@/interface/test-helpers/replace-account-roles-with-permission-sets"
import { seedIamTestAccount } from "@/interface/test-helpers/seed-iam-test-account"
import { ForbiddenError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

describe("RegisterEmployee live actor authorization", () => {
  test("fails closed when employee:create is revoked before provisioning", async () => {
    const { context, db } = createTestContext()
    await db.prepare("UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1").run()
    const actorAccountId = await seedIamTestAccount(context, "E960")
    const [actorRole] = await replaceAccountRolesWithPermissionSets(
      context,
      actorAccountId,
      "employee-create-race",
      [["employee:create", "employee:lifecycle:apply", "account:manage"]],
    )
    const session = await sessionFor(context, actorAccountId)

    if (actorRole === undefined) throw new Error("actor role not created")

    mutateBeforeNextBatch(context, db, () =>
      removePermissionFromRole(db, actorRole.id, "employee:create"),
    )

    const result = await new RegisterEmployee(context).run({
      session,
      employee: employeeInput("E961", "member"),
    })

    expectApplicationError(result, ForbiddenError, "role_escalation_forbidden")
    expect(await employeeCount(db, "E961")).toBe(0)
  })

  test("fails closed when employee:assign_role is revoked before assigning a non-member role", async () => {
    const { context, db } = createTestContext()
    await db.prepare("UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1").run()
    const actorAccountId = await seedIamTestAccount(context, "E962")
    const [actorRole] = await replaceAccountRolesWithPermissionSets(
      context,
      actorAccountId,
      "employee-assign-race",
      [["employee:create", "employee:assign_role", "employee:lifecycle:apply", "account:manage"]],
    )
    const targetRole = await createRole(context, "empty-provisioned-role", [])
    const session = await sessionFor(context, actorAccountId)

    if (actorRole === undefined) throw new Error("actor role not created")

    mutateBeforeNextBatch(context, db, () =>
      removePermissionFromRole(db, actorRole.id, "employee:assign_role"),
    )

    const result = await new RegisterEmployee(context).run({
      session,
      employee: employeeInput("E963", targetRole.key),
    })

    expectApplicationError(result, ForbiddenError, "role_escalation_forbidden")
    expect(await employeeCount(db, "E963")).toBe(0)
  })

  test("fails closed when the actor loses a target-role permission before provisioning", async () => {
    const { context, db } = createTestContext()
    await db.prepare("UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1").run()
    const actorAccountId = await seedIamTestAccount(context, "E964")
    const [actorRole] = await replaceAccountRolesWithPermissionSets(
      context,
      actorAccountId,
      "employee-role-superset-race",
      [
        [
          "employee:create",
          "employee:assign_role",
          "employee:lifecycle:apply",
          "account:manage",
          "dashboard:view",
        ],
      ],
    )
    const targetRole = await createRole(context, "dashboard-provisioned-role", ["dashboard:view"])
    const session = await sessionFor(context, actorAccountId)

    if (actorRole === undefined) throw new Error("actor role not created")

    mutateBeforeNextBatch(context, db, () =>
      removePermissionFromRole(db, actorRole.id, "dashboard:view"),
    )

    const result = await new RegisterEmployee(context).run({
      session,
      employee: employeeInput("E965", targetRole.key),
    })

    expectApplicationError(result, ForbiddenError, "role_escalation_forbidden")
    expect(await employeeCount(db, "E965")).toBe(0)
  })
})

function employeeInput(code: string, role: string) {
  return {
    code,
    name: "Sam Rivers",
    email: `you+${code.toLowerCase()}@example.com`,
    password: "InitialPassword1",
    role,
    hireOn: "2026-01-01",
    departmentCode: null,
    positionTitle: null,
    managerEmployeeCode: null,
  }
}

async function createRole(context: Context, key: string, permissionKeys: ReadonlyArray<string>) {
  const role = await new RoleRepository(context).createWithPermissions({
    key,
    name: key,
    description: null,
    createdAt: 0,
    permissionKeys,
  })

  if (role instanceof Error || typeof role === "string") {
    throw new Error("role setup failed")
  }

  return role
}

async function sessionFor(context: Context, accountId: number): Promise<Session> {
  const account = await new AccountAuthRepository(context).resolveById(accountId)

  if (account === null || account instanceof Error || account.employeeId === null) {
    throw new Error("account setup failed")
  }

  return new Session({
    accountId: account.accountId,
    employeeId: account.employeeId,
    employeeStatus: "active",
    permissions: account.permissions,
    roleKeys: account.roleKeys,
  })
}

function mutateBeforeNextBatch(
  context: Context,
  db: D1Database,
  mutation: () => Promise<unknown>,
): void {
  let pending = true

  context.env.DB = new Proxy(db, {
    get(target, property, receiver) {
      if (property === "batch") {
        return async (statements: Array<D1PreparedStatement>) => {
          if (pending) {
            pending = false
            await mutation()
          }

          return target.batch(statements)
        }
      }

      return Reflect.get(target, property, receiver)
    },
  })
}

async function removePermissionFromRole(
  db: D1Database,
  roleId: number,
  permissionKey: string,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM role_permissions
       WHERE role_id = ?1
         AND permission_id = (SELECT id FROM permissions WHERE key = ?2)`,
    )
    .bind(roleId, permissionKey)
    .run()
}

async function employeeCount(db: D1Database, code: string): Promise<number> {
  return (
    (await db
      .prepare("SELECT COUNT(*) AS total FROM employees WHERE code = ?1")
      .bind(code)
      .first<number>("total")) ?? 0
  )
}
