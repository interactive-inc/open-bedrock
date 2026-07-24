import { RevokeAccountRole } from "@/application/iam/revoke-account-role"
import { UpdateRole } from "@/application/iam/update-role"
import { ConflictError } from "@/lib/errors"
import { AccountRepository } from "@/infrastructure/iam/account-repository"
import { LastRootError } from "@/infrastructure/iam/last-root-error"
import { RoleRepository } from "@/infrastructure/iam/role-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { expectApplicationError } from "@/interface/test-helpers/expect-application-error"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { EFFECTIVE_ROOT_TEST_PERMISSION_KEYS } from "@/interface/test-helpers/effective-root-test-permission-keys"
import { replaceAccountRolesWithPermissionSets } from "@/interface/test-helpers/replace-account-roles-with-permission-sets"
import { seedIamTestAccount } from "@/interface/test-helpers/seed-iam-test-account"
import { describe, expect, test } from "bun:test"

describe("effective administrator invariant", () => {
  test("rolls back a role update that would remove the last effective administrator", async () => {
    const { context, db } = createTestContext()

    const accountId = await seedIamTestAccount(context, "E974", "root")

    const roleRepository = new RoleRepository(context)
    const adminRole = await roleRepository.findByKey("root")

    if (adminRole === null || adminRole instanceof Error) {
      throw new Error("admin role not found")
    }

    const beforePermissionKeys = await roleRepository.permissionKeysOf(adminRole.id)

    if (beforePermissionKeys instanceof Error) {
      throw beforePermissionKeys
    }

    const result = await new UpdateRole(context).run({
      session: makeTestSession("root", accountId),
      roleId: adminRole.id,
      name: "Unsafe administrator",
      description: "must be rolled back",
      permissionKeys: beforePermissionKeys.filter((key) => key !== "account:manage"),
      now: 1,
    })

    expectApplicationError(result, ConflictError, "last_admin")

    const afterRole = await roleRepository.findById(adminRole.id)
    const afterPermissionKeys = await roleRepository.permissionKeysOf(adminRole.id)

    expect(afterRole instanceof Error || afterRole === null ? null : afterRole.name).toBe(
      adminRole.name,
    )
    expect(afterPermissionKeys instanceof Error ? [] : [...afterPermissionKeys].sort()).toEqual(
      [...beforePermissionKeys].sort(),
    )

    const activeAdminCount = await db
      .prepare("SELECT COUNT(*) AS count FROM accounts WHERE status = 'active'")
      .first<number>("count")

    expect(activeAdminCount).toBe(1)
  })

  test("rolls back revoking a dynamic role from the last effective administrator", async () => {
    const { context, db } = createTestContext()
    const accountId = await seedIamTestAccount(context, "E975")
    const [effectiveRole] = await replaceAccountRolesWithPermissionSets(
      context,
      accountId,
      "effective-root-revoke",
      [EFFECTIVE_ROOT_TEST_PERMISSION_KEYS],
    )

    if (effectiveRole === undefined) {
      throw new Error("effective admin role not created")
    }

    const result = await new RevokeAccountRole(context).run({
      session: makeTestSession("root", accountId),
      accountId: accountId,
      roleKey: effectiveRole.key,
      now: 10,
    })

    expectApplicationError(result, ConflictError, "last_admin")

    const assignmentCount = await db
      .prepare("SELECT COUNT(*) AS count FROM account_roles WHERE account_id = ?1 AND role_id = ?2")
      .bind(accountId, effectiveRole.id)
      .first<number>("count")
    const tokenVersion = await db
      .prepare("SELECT token_version FROM accounts WHERE id = ?1")
      .bind(accountId)
      .first<number>("token_version")

    expect(assignmentCount).toBe(1)
    expect(tokenVersion).toBe(0)
  })

  test("rolls back suspending the last effective administrator with dynamic roles", async () => {
    const { context, db } = createTestContext()
    const accountId = await seedIamTestAccount(context, "E976")

    await replaceAccountRolesWithPermissionSets(context, accountId, "effective-root-status", [
      EFFECTIVE_ROOT_TEST_PERMISSION_KEYS,
    ])

    // Application 層は自己停止を先に拒否するため、repository の最終防御を直接検証する。
    const result = await new AccountRepository(context).setStatusGuardingLastRoot(
      accountId,
      "suspended",
      10,
      accountId,
    )

    expect(result).toBeInstanceOf(LastRootError)

    const account = await db
      .prepare("SELECT status, token_version FROM accounts WHERE id = ?1")
      .bind(accountId)
      .first<{ status: string; token_version: number }>()

    expect(account).toEqual({ status: "active", token_version: 0 })
  })
})
