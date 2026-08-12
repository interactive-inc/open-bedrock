import { ArchiveEmployee } from "@/application/employee-lifecycle/archive-employee"
import { DeleteEmployee } from "@/application/employee/delete-employee"
import { UpdateEmployee } from "@/application/employee/update-employee"
import { Employee } from "@/contexts/company/domain/employee/employee.entity"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { ConflictError } from "@/lib/errors"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { expectApplicationError } from "@/interface/test-helpers/expect-application-error"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { EFFECTIVE_ROOT_TEST_PERMISSION_KEYS } from "@/interface/test-helpers/effective-root-test-permission-keys"
import { replaceAccountRolesWithPermissionSets } from "@/interface/test-helpers/replace-account-roles-with-permission-sets"
import { seedIamTestAccount } from "@/interface/test-helpers/seed-iam-test-account"
import { describe, expect, test } from "bun:test"

describe("employee mutations preserve an effective administrator", () => {
  test("a name-only ledger update cannot retire an effective administrator", async () => {
    const { context } = createTestContext()
    const employeeId = await seedIamTestAccount(context, "E977")

    await replaceAccountRolesWithPermissionSets(context, employeeId, "effective-root-retire", [
      EFFECTIVE_ROOT_TEST_PERMISSION_KEYS,
    ])

    const result = await new UpdateEmployee(context).run({
      session: makeTestSession("root", 999),
      viewerEmployeeId: 999,
      code: "E977",
      name: "Sam Rivers Updated",
    })

    expect(result).toBeInstanceOf(Employee)

    const employee = await new EmployeeRepository(context).findByCode("E977")

    expect(employee).toBeInstanceOf(Employee)

    if (employee instanceof Employee) {
      expect(employee.name).toBe("Sam Rivers Updated")
      expect(employee.status).toBe("active")
    }
  })

  test("requires history-preserving archive instead of physical deletion", async () => {
    const { context, db } = createTestContext()
    const employeeId = await seedIamTestAccount(context, "E978")

    await replaceAccountRolesWithPermissionSets(context, employeeId, "effective-root-delete", [
      EFFECTIVE_ROOT_TEST_PERMISSION_KEYS,
    ])

    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("root", 999),
      viewerEmployeeId: 999,
      code: "E978",
    })

    expectApplicationError(result, ConflictError, "employee_archive_required")

    const employee = await new EmployeeRepository(context).findByCode("E978")
    const accountCount = await db
      .prepare("SELECT COUNT(*) AS count FROM account_employee_links WHERE employee_id = ?1")
      .bind(employeeId)
      .first<number>("count")
    const assignmentCount = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM account_roles WHERE account_id IN (SELECT account_id FROM account_employee_links WHERE employee_id = ?1)",
      )
      .bind(employeeId)
      .first<number>("count")

    expect(employee).toBeInstanceOf(Employee)
    expect(accountCount).toBe(1)
    expect(assignmentCount).toBe(1)
  })

  test("rolls back archiving the last effective administrator and keeps IAM active", async () => {
    const { context, db } = createTestContext()
    const employeeId = await seedIamTestAccount(context, "E979")
    await replaceAccountRolesWithPermissionSets(context, employeeId, "effective-root-archive", [
      EFFECTIVE_ROOT_TEST_PERMISSION_KEYS,
    ])
    await db.exec(`
      UPDATE employees SET status = 'retired' WHERE id = ${employeeId};
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      VALUES ('fixture-employment-e979', 1, ${employeeId}, '2025-01-01', '2025-12-31',
              0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('fixture-status-e979', 1, 'fixture-employment-e979', ${employeeId},
              'active', '2025-01-01', '2025-12-31', 0, 'fixture', 1);
      UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
    `)

    const result = await new ArchiveEmployee(context).run({
      session: makeTestSession("root", 999),
      employeeCode: "E979",
      archivedAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "last_admin")
    expect(
      await db
        .prepare("SELECT archived_at FROM employees WHERE id = ?1")
        .bind(employeeId)
        .first("archived_at"),
    ).toBeNull()
    expect(
      await db
        .prepare(
          "SELECT account.status FROM accounts account JOIN account_employee_links link ON link.account_id = account.id WHERE link.employee_id = ?1",
        )
        .bind(employeeId)
        .first<string>("status"),
    ).toBe("active")
  })
})
