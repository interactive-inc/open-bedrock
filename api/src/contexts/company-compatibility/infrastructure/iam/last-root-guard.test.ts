import type { Context } from "@/env"
import { LastRootGuard } from "@/contexts/company-compatibility/infrastructure/iam/last-root-guard"
import { createTestContext } from "@/api/test/support/create-test-context"
import { EFFECTIVE_ROOT_TEST_PERMISSION_KEYS } from "@/api/test/support/effective-root-test-permission-keys"
import { replaceAccountRolesWithPermissionSets } from "@/api/test/support/replace-account-roles-with-permission-sets"
import { seedIamTestAccount } from "@/api/test/support/seed-iam-test-account"
import { describe, expect, test } from "bun:test"

async function guardError(context: Context): Promise<unknown> {
  try {
    await context.env.DB.batch([new LastRootGuard(context).abortWhenNoLoginEnabledEffectiveRoot()])

    return null
  } catch (error) {
    return error
  }
}

describe("last effective admin guard", () => {
  test("accepts one active account whose required permissions are the union of dynamic roles", async () => {
    const { context } = createTestContext()
    const accountId = await seedIamTestAccount(context, "E970")

    await replaceAccountRolesWithPermissionSets(context, accountId, "effective-root-split", [
      EFFECTIVE_ROOT_TEST_PERMISSION_KEYS.slice(0, 2),
      EFFECTIVE_ROOT_TEST_PERMISSION_KEYS.slice(2),
    ])

    expect(await guardError(context)).toBeNull()
  })

  test("rejects a system admin role when its account lacks one required permission", async () => {
    const { context, db } = createTestContext()

    await seedIamTestAccount(context, "E971", "root")
    await db
      .prepare(
        `DELETE FROM role_permissions
         WHERE role_id = (SELECT id FROM roles WHERE key = 'root' AND is_system = 1)
           AND permission_id = (SELECT id FROM permissions WHERE key = 'account:manage')`,
      )
      .run()

    expect(LastRootGuard.isAbortedBy(await guardError(context))).toBe(true)
  })

  test("does not combine required permissions held by different accounts", async () => {
    const { context } = createTestContext()
    const firstId = await seedIamTestAccount(context, "E972")
    const secondId = await seedIamTestAccount(context, "E973")

    await replaceAccountRolesWithPermissionSets(context, firstId, "effective-root-first", [
      EFFECTIVE_ROOT_TEST_PERMISSION_KEYS.slice(0, 2),
    ])
    await replaceAccountRolesWithPermissionSets(context, secondId, "effective-root-second", [
      EFFECTIVE_ROOT_TEST_PERMISSION_KEYS.slice(2),
    ])

    expect(LastRootGuard.isAbortedBy(await guardError(context))).toBe(true)
  })
})
