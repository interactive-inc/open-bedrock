import { Session } from "@/contexts/company/domain/iam/session"
import { RegisterEmployee } from "@/contexts/company/application/employee/register-employee"
import type { Context } from "@/env"
import { AccountAuthRepository } from "@/contexts/company/application/auth/account-auth-repository"
import { AccountEmployeeLinkRepository } from "@/contexts/company/infrastructure/employee/account-employee-link-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { replaceAccountRolesWithPermissionSets } from "@/api/test/support/replace-account-roles-with-permission-sets"
import { seedIamTestAccount } from "@/api/test/support/seed-iam-test-account"
import { ForbiddenError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"
import type { AccountId } from "@/contexts/system/domain/auth/account-id"

describe("RegisterEmployee live actor authorization", () => {
  test("fails closed when employee:create is revoked before provisioning", async () => {
    const { context, db } = createTestContext()
    await db.prepare("UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1").run()
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
    await db.prepare("UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1").run()
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
    await db.prepare("UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1").run()
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
  const id = crypto.randomUUID()
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
         VALUES (?1, ?2, 'custom', ?3, 0, 0)`,
    ).bind(id, `company:${key}`, key),
    ...permissionKeys.map((permissionKey) =>
      context.env.DB.prepare(
        `INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)`,
      ).bind(id, permissionKey),
    ),
  ])

  return { id, key }
}

async function sessionFor(context: Context, accountId: AccountId): Promise<Session> {
  const account = await new AccountAuthRepository(context).resolveById(accountId)

  const linkedAccount = await new AccountEmployeeLinkRepository(context).findLinkedAccount(
    accountId,
  )

  if (
    account === null ||
    account instanceof Error ||
    linkedAccount === null ||
    linkedAccount instanceof Error ||
    linkedAccount.employeeId === null
  ) {
    throw new Error("account setup failed")
  }

  return new Session({
    accountId: account.accountId,
    employeeId: linkedAccount.employeeId,
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
  roleId: string,
  permissionKey: string,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM system_iam_role_permissions
       WHERE role_id = ?1 AND permission_key = ?2`,
    )
    .bind(String(roleId), permissionKey)
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
