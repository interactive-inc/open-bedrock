import {
  abortWhenNoLoginEnabledEffectiveAdmin,
  isAbortedByLastAdminGuard,
} from "@/infrastructure/iam/last-admin-guard"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import {
  EFFECTIVE_ADMIN_TEST_PERMISSION_KEYS,
  replaceAccountRolesWithPermissionSets,
  seedIamTestAccount,
} from "@/interface/test-helpers/seed-effective-admin"
import { describe, expect, test } from "bun:test"

async function guardError(db: D1Database): Promise<unknown> {
  try {
    await db.batch([abortWhenNoLoginEnabledEffectiveAdmin(db)])

    return null
  } catch (error) {
    return error
  }
}

describe("last effective admin guard", () => {
  test("accepts one active account whose required permissions are the union of dynamic roles", async () => {
    const { context, db } = createTestContext()
    const accountId = await seedIamTestAccount(context, "E970")

    await replaceAccountRolesWithPermissionSets(context, accountId, "effective-admin-split", [
      EFFECTIVE_ADMIN_TEST_PERMISSION_KEYS.slice(0, 2),
      EFFECTIVE_ADMIN_TEST_PERMISSION_KEYS.slice(2),
    ])

    expect(await guardError(db)).toBeNull()
  })

  test("rejects a system admin role when its account lacks one required permission", async () => {
    const { context, db } = createTestContext()

    await seedIamTestAccount(context, "E971", "admin")
    await db
      .prepare(
        `DELETE FROM role_permissions
         WHERE role_id = (SELECT id FROM roles WHERE key = 'admin' AND is_system = 1)
           AND permission_id = (SELECT id FROM permissions WHERE key = 'account:manage')`,
      )
      .run()

    expect(isAbortedByLastAdminGuard(await guardError(db))).toBe(true)
  })

  test("does not combine required permissions held by different accounts", async () => {
    const { context, db } = createTestContext()
    const firstId = await seedIamTestAccount(context, "E972")
    const secondId = await seedIamTestAccount(context, "E973")

    await replaceAccountRolesWithPermissionSets(context, firstId, "effective-admin-first", [
      EFFECTIVE_ADMIN_TEST_PERMISSION_KEYS.slice(0, 2),
    ])
    await replaceAccountRolesWithPermissionSets(context, secondId, "effective-admin-second", [
      EFFECTIVE_ADMIN_TEST_PERMISSION_KEYS.slice(2),
    ])

    expect(isAbortedByLastAdminGuard(await guardError(db))).toBe(true)
  })
})
