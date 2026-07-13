import { DeleteEmployee } from "@/application/employee/delete-employee"
import { UpdateEmployee } from "@/application/employee/update-employee"
import { Employee } from "@/domain/employee/employee.entity"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { ConflictError } from "@/lib/errors"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { expectApplicationError } from "@/interface/shared/test/expect-application-error"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import {
  EFFECTIVE_ADMIN_TEST_PERMISSION_KEYS,
  replaceAccountRolesWithPermissionSets,
  seedIamTestAccount,
} from "@/interface/shared/test/seed-effective-admin"
import { describe, expect, test } from "bun:test"

describe("employee mutations preserve an effective administrator", () => {
  test("rolls back retiring the last effective administrator with a dynamic role", async () => {
    const { context } = createTestContext()
    const employeeId = await seedIamTestAccount(context, "E977")

    await replaceAccountRolesWithPermissionSets(context, employeeId, "effective-admin-retire", [
      EFFECTIVE_ADMIN_TEST_PERMISSION_KEYS,
    ])

    const result = await new UpdateEmployee(context).run({
      session: makeTestSession("admin", 999),
      viewerEmployeeId: 999,
      code: "E977",
      profile: {
        name: "Sam Rivers",
        deptId: 3,
        deptName: "Engineering",
        position: "Engineer",
        status: "retired",
      },
    })

    expectApplicationError(result, ConflictError, "last_admin")

    const employee = await new EmployeeRepository(context).findByCode("E977")

    expect(employee).toBeInstanceOf(Employee)

    if (employee instanceof Employee) {
      expect(employee.status).toBe("active")
    }
  })

  test("rolls back deleting the last effective administrator and its IAM records", async () => {
    const { context, db } = createTestContext()
    const employeeId = await seedIamTestAccount(context, "E978")

    await replaceAccountRolesWithPermissionSets(context, employeeId, "effective-admin-delete", [
      EFFECTIVE_ADMIN_TEST_PERMISSION_KEYS,
    ])

    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("admin", 999),
      viewerEmployeeId: 999,
      code: "E978",
    })

    expectApplicationError(result, ConflictError, "last_admin")

    const employee = await new EmployeeRepository(context).findByCode("E978")
    const accountCount = await db
      .prepare("SELECT COUNT(*) AS count FROM accounts WHERE employee_id = ?1")
      .bind(employeeId)
      .first<number>("count")
    const assignmentCount = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM account_roles WHERE account_id IN (SELECT id FROM accounts WHERE employee_id = ?1)",
      )
      .bind(employeeId)
      .first<number>("count")

    expect(employee).toBeInstanceOf(Employee)
    expect(accountCount).toBe(1)
    expect(assignmentCount).toBe(1)
  })
})
