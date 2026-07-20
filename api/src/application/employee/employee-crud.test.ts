import { Session } from "@/lib/auth/session"
import { DeleteEmployee } from "@/application/employee/delete-employee"
import { GetEmployee } from "@/application/employee/get-employee"
import { RegisterEmployee } from "@/application/employee/register-employee"
import { UpdateEmployee } from "@/application/employee/update-employee"
import { Employee } from "@/domain/employee/employee.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { expectApplicationError } from "@/interface/test-helpers/expect-application-error"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

async function seedEmployee(
  context: Context,
  code: string,
  options: { role?: string; status?: "active" | "leave" | "retired" } = {},
): Promise<number> {
  const created = await new EmployeeRepository(context).create({
    code,
    name: "Sam Rivers",
    deptId: 3,
    deptName: "Engineering",
    position: "Engineer",
    status: options.status ?? "active",
  })
  if (created instanceof Error) throw created
  if (options.role !== undefined) {
    await seedIamForEmployees(context.env.DB, [
      {
        id: created.id,
        email: `you+${code.toLowerCase()}@example.com`,
        passwordHash: "hash",
        role: options.role,
      },
    ])
  }
  return created.id
}

const newEmployeeInput = {
  code: "E900",
  name: "Sam Rivers",
  email: "you+e900@example.com",
  password: "InitialPassword1",
  role: "member",
  hireOn: "2026-01-01",
  departmentCode: null,
  positionTitle: null,
  managerEmployeeCode: null,
}

describe("RegisterEmployee", () => {
  test("registers employee and IAM records atomically for a privileged role", async () => {
    const { context, db } = createTestContext()
    await db.prepare("UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1").run()
    const adminId = await seedEmployee(context, "E899", { role: "admin" })
    const result = await new RegisterEmployee(context).run({
      session: makeTestSession("admin", adminId),
      employee: newEmployeeInput,
    })
    expect(result).toBeInstanceOf(Employee)
    if (result instanceof ApplicationError) throw result
    expect(result.code).toBe("E900")
    expect(
      await db
        .prepare(
          `SELECT COUNT(*) FROM accounts
           WHERE employee_id = (SELECT id FROM employees WHERE code = 'E900')`,
        )
        .first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare(
          `SELECT COUNT(*) FROM personnel_actions
           WHERE employee_id = (SELECT id FROM employees WHERE code = 'E900')
             AND kind = 'hire' AND source_type = 'direct'`,
        )
        .first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare(
          `SELECT COUNT(*) FROM employment_period_versions
           WHERE employee_id = (SELECT id FROM employees WHERE code = 'E900')`,
        )
        .first<number>("COUNT(*)"),
    ).toBe(1)
  })

  test("rejects missing permission, excessive role, duplicate code, and weak password", async () => {
    const { context } = createTestContext()
    expectApplicationError(
      await new RegisterEmployee(context).run({
        session: makeTestSession("member"),
        employee: newEmployeeInput,
      }),
      ForbiddenError,
      "forbidden",
    )
    const limited = new Session({
      accountId: 1,
      employeeId: 1,
      employeeStatus: "active",
      permissions: new Set([
        "employee:create",
        "employee:assign_role",
        "employee:lifecycle:apply",
        "account:manage",
      ]),
      roleKeys: ["employee-provisioner"],
    })
    expectApplicationError(
      await new RegisterEmployee(context).run({
        session: limited,
        employee: { ...newEmployeeInput, role: "admin" },
      }),
      ForbiddenError,
      "role_escalation_forbidden",
    )
    await seedEmployee(context, "E900")
    expectApplicationError(
      await new RegisterEmployee(context).run({
        session: makeTestSession("admin"),
        employee: newEmployeeInput,
      }),
      ConflictError,
      "employee_code_conflict",
    )
    expectApplicationError(
      await new RegisterEmployee(context).run({
        session: makeTestSession("admin"),
        employee: { ...newEmployeeInput, code: "E901", password: "short7!" },
      }),
      ValidationError,
      "weak_password",
    )
  })
})

describe("GetEmployee", () => {
  test("returns by code and conceals unknown employees", async () => {
    const { context } = createTestContext()
    await seedEmployee(context, "E901")
    expect(await new GetEmployee(context).run({ code: "E901" })).toBeInstanceOf(Employee)
    expectApplicationError(
      await new GetEmployee(context).run({ code: "E999" }),
      NotFoundError,
      "employee_not_found",
    )
  })
})

describe("UpdateEmployee", () => {
  test("updates only the ledger name and preserves lifecycle compatibility fields", async () => {
    const { context } = createTestContext()
    await seedEmployee(context, "E902")
    const result = await new UpdateEmployee(context).run({
      session: makeTestSession("admin"),
      viewerEmployeeId: 0,
      code: "E902",
      name: "Renamed",
    })
    expect(result).toBeInstanceOf(Employee)
    if (result instanceof ApplicationError) throw result
    expect(result).toMatchObject({ name: "Renamed", status: "active", position: "Engineer" })
  })

  test("enforces permission and existence", async () => {
    const { context } = createTestContext()
    await seedEmployee(context, "E904")
    expectApplicationError(
      await new UpdateEmployee(context).run({
        session: makeTestSession("member"),
        viewerEmployeeId: 0,
        code: "E904",
        name: "Renamed",
      }),
      ForbiddenError,
      "forbidden",
    )
    expectApplicationError(
      await new UpdateEmployee(context).run({
        session: makeTestSession("admin"),
        viewerEmployeeId: 0,
        code: "E999",
        name: "Renamed",
      }),
      NotFoundError,
      "employee_not_found",
    )
  })
})

describe("DeleteEmployee", () => {
  test("always preserves an existing employee and directs privileged callers to archive", async () => {
    const { context, db } = createTestContext()
    const id = await seedEmployee(context, "E905", { role: "member" })
    await db
      .prepare(
        "INSERT INTO attendance_records (employee_id, work_date, status) VALUES (?1, '2026-01-01', 'present')",
      )
      .bind(id)
      .run()
    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("admin"),
      viewerEmployeeId: id + 1,
      code: "E905",
    })
    expectApplicationError(result, ConflictError, "employee_archive_required")
    expect(await new EmployeeRepository(context).findByCode("E905")).toBeInstanceOf(Employee)
    expect(
      await db
        .prepare("SELECT COUNT(*) FROM attendance_records WHERE employee_id = ?1")
        .bind(id)
        .first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare("SELECT COUNT(*) FROM accounts WHERE employee_id = ?1")
        .bind(id)
        .first<number>("COUNT(*)"),
    ).toBe(1)
  })

  test("enforces permission and existence before the archive redirect", async () => {
    const { context } = createTestContext()
    await seedEmployee(context, "E906")
    expectApplicationError(
      await new DeleteEmployee(context).run({
        session: makeTestSession("member"),
        viewerEmployeeId: 1,
        code: "E906",
      }),
      ForbiddenError,
      "forbidden",
    )
    expectApplicationError(
      await new DeleteEmployee(context).run({
        session: makeTestSession("admin"),
        viewerEmployeeId: 1,
        code: "E999",
      }),
      NotFoundError,
      "employee_not_found",
    )
  })
})
