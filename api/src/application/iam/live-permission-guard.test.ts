import { Session } from "@/contexts/company/domain/iam/session"
import { GrantAccountRole } from "@/application/iam/grant-account-role"
import { RevokeAccountRole } from "@/application/iam/revoke-account-role"
import { SetAccountStatus } from "@/application/iam/set-account-status"
import { UpdateRole } from "@/application/iam/update-role"
import type { Context } from "@/env"
import { AccountAuthRepository } from "@/infrastructure/auth/account-auth-repository"
import { AccountEmployeeLinkRepository } from "@/infrastructure/employee/account-employee-link-repository"
import { RoleRepository } from "@/infrastructure/iam/role-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { expectApplicationError } from "@/interface/test-helpers/expect-application-error"
import { replaceAccountRolesWithPermissionSets } from "@/interface/test-helpers/replace-account-roles-with-permission-sets"
import { seedIamTestAccount } from "@/interface/test-helpers/seed-iam-test-account"
import { ForbiddenError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

const BASE_PERMISSION = "dashboard:view"
const ELEVATED_PERMISSION = "employee:delete"

describe("atomic IAM live-permission boundary", () => {
  test("role update fails closed when the target role is elevated before its batch", async () => {
    const { context, db } = createTestContext()

    await seedIamTestAccount(context, "E980", "root")
    const actorAccountId = await seedLimitedActor(context, "E981", [
      "iam:manage_roles",
      BASE_PERMISSION,
    ])
    const targetRole = await createRole(context, "race-update-role", [BASE_PERMISSION])
    const session = await sessionFor(context, actorAccountId)

    mutateBeforeNextBatch(context, db, () =>
      addPermissionToRole(db, targetRole.id, ELEVATED_PERMISSION),
    )

    const result = await new UpdateRole(context).run({
      session,
      roleId: targetRole.id,
      name: "Raced update",
      description: null,
      permissionKeys: [BASE_PERMISSION],
      now: 1,
    })

    expectApplicationError(result, ForbiddenError, "role_escalation")

    const persistedRole = await new RoleRepository(context).findById(targetRole.id)

    expect(
      persistedRole instanceof Error || persistedRole === null ? null : persistedRole.name,
    ).toBe("race-update-role")
  })

  test("role revocation fails closed when the target role is elevated before its batch", async () => {
    const { context, db } = createTestContext()

    await seedIamTestAccount(context, "E982", "root")
    const actorAccountId = await seedLimitedActor(context, "E983", [
      "iam:assign_roles",
      BASE_PERMISSION,
    ])
    const targetAccountId = await seedIamTestAccount(context, "E984")
    const targetRole = await createRole(context, "race-revoke-role", [BASE_PERMISSION])

    await assignRole(db, targetAccountId, targetRole.id)

    const session = await sessionFor(context, actorAccountId)

    mutateBeforeNextBatch(context, db, () =>
      addPermissionToRole(db, targetRole.id, ELEVATED_PERMISSION),
    )

    const result = await new RevokeAccountRole(context).run({
      session,
      accountId: targetAccountId,
      roleKey: targetRole.key,
      now: 2,
    })

    expectApplicationError(result, ForbiddenError, "role_escalation")
    expect(await countAssignment(db, targetAccountId, targetRole.id)).toBe(1)
    expect(await tokenVersionOf(db, targetAccountId)).toBe(0)
  })

  test("role grant fails closed when the target role is elevated before its batch", async () => {
    const { context, db } = createTestContext()

    await seedIamTestAccount(context, "E985", "root")
    const actorAccountId = await seedLimitedActor(context, "E986", [
      "iam:assign_roles",
      BASE_PERMISSION,
    ])
    const targetAccountId = await seedIamTestAccount(context, "E987")
    const targetRole = await createRole(context, "race-grant-role", [BASE_PERMISSION])
    const session = await sessionFor(context, actorAccountId)

    mutateBeforeNextBatch(context, db, () =>
      addPermissionToRole(db, targetRole.id, ELEVATED_PERMISSION),
    )

    const result = await new GrantAccountRole(context).run({
      session,
      accountId: targetAccountId,
      roleKey: targetRole.key,
      now: 3,
    })

    expectApplicationError(result, ForbiddenError, "role_escalation")
    expect(await countAssignment(db, targetAccountId, targetRole.id)).toBe(0)
    expect(await tokenVersionOf(db, targetAccountId)).toBe(0)
  })

  test("account status change fails closed when the target account is elevated before its batch", async () => {
    const { context, db } = createTestContext()

    await seedIamTestAccount(context, "E988", "root")
    const actorAccountId = await seedLimitedActor(context, "E989", [
      "account:manage",
      BASE_PERMISSION,
    ])
    const targetAccountId = await seedLimitedActor(context, "E990", [BASE_PERMISSION])
    const elevatedRole = await createRole(context, "race-status-role", [ELEVATED_PERMISSION])
    const session = await sessionFor(context, actorAccountId)

    mutateBeforeNextBatch(context, db, () => assignRole(db, targetAccountId, elevatedRole.id))

    const result = await new SetAccountStatus(context).run({
      session,
      accountId: targetAccountId,
      status: "suspended",
      now: 4,
    })

    expectApplicationError(result, ForbiddenError, "role_escalation")

    const account = await db
      .prepare("SELECT status, token_version FROM accounts WHERE id = ?1")
      .bind(targetAccountId)
      .first<{ status: string; token_version: number }>()

    expect(account).toEqual({ status: "active", token_version: 0 })
  })

  test("role grant rechecks the actor action permission from the live database", async () => {
    const { context, db } = createTestContext()

    await seedIamTestAccount(context, "E991", "root")
    const actorAccountId = await seedIamTestAccount(context, "E992")
    const [actorRole] = await replaceAccountRolesWithPermissionSets(
      context,
      actorAccountId,
      "race-actor-role",
      [["iam:assign_roles", BASE_PERMISSION]],
    )
    const targetAccountId = await seedIamTestAccount(context, "E993")
    const targetRole = await createRole(context, "race-actor-grant-role", [BASE_PERMISSION])
    const session = await sessionFor(context, actorAccountId)

    if (actorRole === undefined) throw new Error("actor role not created")

    mutateBeforeNextBatch(context, db, () =>
      removePermissionFromRole(db, actorRole.id, "iam:assign_roles"),
    )

    const result = await new GrantAccountRole(context).run({
      session,
      accountId: targetAccountId,
      roleKey: targetRole.key,
      now: 5,
    })

    expectApplicationError(result, ForbiddenError, "role_escalation")
    expect(await countAssignment(db, targetAccountId, targetRole.id)).toBe(0)
  })
})

async function seedLimitedActor(
  context: Context,
  code: string,
  permissionKeys: ReadonlyArray<string>,
): Promise<number> {
  const accountId = await seedIamTestAccount(context, code)

  await replaceAccountRolesWithPermissionSets(context, accountId, `permissions-${code}`, [
    permissionKeys,
  ])

  return accountId
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

async function addPermissionToRole(
  db: D1Database,
  roleId: number,
  permissionKey: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
       SELECT ?1, id FROM permissions WHERE key = ?2`,
    )
    .bind(roleId, permissionKey)
    .run()
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

async function assignRole(db: D1Database, accountId: number, roleId: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO account_roles (account_id, role_id, granted_by, granted_at) VALUES (?1, ?2, NULL, 0)",
    )
    .bind(accountId, roleId)
    .run()
}

async function countAssignment(db: D1Database, accountId: number, roleId: number): Promise<number> {
  return (
    (await db
      .prepare("SELECT COUNT(*) AS total FROM account_roles WHERE account_id = ?1 AND role_id = ?2")
      .bind(accountId, roleId)
      .first<number>("total")) ?? 0
  )
}

async function tokenVersionOf(db: D1Database, accountId: number): Promise<number | null> {
  return db
    .prepare("SELECT token_version FROM accounts WHERE id = ?1")
    .bind(accountId)
    .first<number>("token_version")
}
