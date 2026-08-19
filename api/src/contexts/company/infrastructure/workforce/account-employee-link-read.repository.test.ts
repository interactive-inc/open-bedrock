import { createTestContext } from "@/api/test/support/create-test-context"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import { AccountEmployeeLinkReadRepository } from "@/contexts/company/infrastructure/workforce/account-employee-link-read.repository"
import { describe, expect, test } from "bun:test"

async function seedLink(db: D1Database, id: number): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO employees (id, code, name, status)
         VALUES (?1, ?2, 'Test Employee', 'active')`,
      )
      .bind(id, `E${id}`),
    db
      .prepare(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, 0, 0)`,
      )
      .bind(id),
    db
      .prepare("INSERT INTO account_employee_links (account_id, employee_id) VALUES (?1, ?1)")
      .bind(id),
  ])
}

describe("AccountEmployeeLinkReadRepository", () => {
  test("maps both query directions to the same opaque eligible link", async () => {
    const { context, db } = createTestContext()
    await seedLink(db, 41)
    const repository = new AccountEmployeeLinkReadRepository(context)
    const expected = {
      link: {
        accountId: restoreWorkforceId("system_account", "41"),
        employeeId: toWorkforceEmployeeId(41),
      },
      accountEligible: true,
    }

    expect(
      await repository.find({
        kind: "by_account",
        accountId: restoreWorkforceId("system_account", "41"),
      }),
    ).toEqual({ ok: true, records: [expected] })
    expect(
      await repository.find({ kind: "by_employee", employeeId: toWorkforceEmployeeId(41) }),
    ).toEqual({ ok: true, records: [expected] })
  })

  test("reports the link but marks a suspended canonical Account ineligible", async () => {
    const { context, db } = createTestContext()
    await seedLink(db, 42)
    await db
      .prepare(
        `UPDATE system_accounts
         SET status = 'suspended', token_version = token_version + 1, updated_at = updated_at + 1
         WHERE id = 42`,
      )
      .run()

    expect(
      await new AccountEmployeeLinkReadRepository(context).find({
        kind: "by_employee",
        employeeId: toWorkforceEmployeeId(42),
      }),
    ).toEqual({
      ok: true,
      records: [
        {
          link: {
            accountId: restoreWorkforceId("system_account", "42"),
            employeeId: toWorkforceEmployeeId(42),
          },
          accountEligible: false,
        },
      ],
    })
  })

  test("treats a foreign Employee ID namespace as not found", async () => {
    const { context } = createTestContext()

    expect(
      await new AccountEmployeeLinkReadRepository(context).find({
        kind: "by_employee",
        employeeId: restoreWorkforceId("employee", "legacy-user:41"),
      }),
    ).toEqual({ ok: true, records: [] })
  })
})
