import { describe, expect, test } from "bun:test"
import { SyncExternalIdentities } from "@/contexts/company-compatibility/application/iam/sync-external-identities"
import { createTestContext } from "@/api/test/support/create-test-context"
import { seedIamTestAccount } from "@/api/test/support/seed-iam-test-account"

const now = new Date("2026-01-01T00:00:00.000Z")

describe("SyncExternalIdentities", () => {
  test("links an external identity to an existing employee found by email", async () => {
    const { context, db } = createTestContext()
    // 既存のパスワード従業員(email: you+e900@example.com)を用意する。
    const employeeId = await seedIamTestAccount(context, "E900", "member")

    const result = await new SyncExternalIdentities(context).run(
      [{ subject: "ext-link-1", email: "you+e900@example.com", name: "Renamed Worker" }],
      now,
    )

    expect(result).toEqual({ created: 1, updated: 0, skipped: 0 })

    // 新規従業員は作らず、既存アカウントに oidc identity を足している。
    const identity = await db
      .prepare(
        `SELECT link.employee_id AS employee_id, identity.provider AS provider
         FROM system_identity_bindings AS identity
         JOIN account_employee_links link ON link.account_id = identity.account_id
         WHERE identity.subject = 'ext-link-1'`,
      )
      .first<{ employee_id: number; provider: string }>()
    expect(identity).toEqual({ employee_id: employeeId, provider: "oidc" })

    // 従業員は増えていない（既存 1 名のまま）。
    const employeeCount = await db.prepare("SELECT COUNT(*) AS n FROM employees").first<number>("n")
    expect(employeeCount).toBe(1)
  })

  test("creates a fresh code-less employee when no employee matches by email", async () => {
    const { context, db } = createTestContext()

    const result = await new SyncExternalIdentities(context).run(
      [{ subject: "ext-new-1", email: "you+new@example.com", name: "Brand New" }],
      now,
    )

    expect(result).toEqual({ created: 1, updated: 0, skipped: 0 })

    const employee = await db
      .prepare("SELECT code FROM employees WHERE name = 'Brand New'")
      .first<{ code: string | null }>()
    expect(employee?.code).toBeNull()
  })

  test("is idempotent across a second identical sync", async () => {
    const { context } = createTestContext()
    const sync = new SyncExternalIdentities(context)
    const inputs = [{ subject: "ext-idem", email: "idem@example.com", name: "Idem" }]

    expect(await sync.run(inputs, now)).toEqual({ created: 1, updated: 0, skipped: 0 })
    expect(await sync.run(inputs, now)).toEqual({ created: 0, updated: 0, skipped: 1 })
  })
})
