import { DeleteEmployee } from "@/application/employee/delete-employee"
import { GetEmployee } from "@/application/employee/get-employee"
import { RegisterEmployee } from "@/application/employee/register-employee"
import { UpdateEmployee } from "@/application/employee/update-employee"
import { Employee } from "@/domain/employee/employee"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

async function seedEmployee(context: Context, code: string): Promise<number> {
  const repository = new EmployeeRepository(context)

  const created = await repository.create({
    code: code,
    name: "Sam Rivers",
    email: `you+${code.toLowerCase()}@example.com`,
    passwordHash: "hash",
    role: "member",
    deptId: 3,
    deptName: "Engineering",
    position: "Engineer",
    status: "active",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

  return created.id
}

const newEmployeeInput = {
  code: "E900",
  name: "Sam Rivers",
  email: "you+e900@example.com",
  password: "initial-password",
  role: "member",
  deptId: 3,
  deptName: "Engineering",
  position: "Engineer",
  status: "active" as const,
}

describe("RegisterEmployee", () => {
  test("registers an employee for a privileged role", async () => {
    const context = createTestContext().context

    const result = await new RegisterEmployee(context).run({
      viewerRole: "admin",
      employee: newEmployeeInput,
    })

    expect(result).toBeInstanceOf(Employee)

    if (result instanceof Error || "reason" in result) {
      throw new Error("register failed")
    }

    expect(result.code).toBe("E900")
    expect(result.deptName).toBe("Engineering")
  })

  test("rejects a non privileged role with forbidden", async () => {
    const context = createTestContext().context

    const result = await new RegisterEmployee(context).run({
      viewerRole: "member",
      employee: newEmployeeInput,
    })

    expect(result).toEqual({ reason: "forbidden" })
  })

  test("rejects a duplicate code with employee_code_conflict", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E900")

    const result = await new RegisterEmployee(context).run({
      viewerRole: "admin",
      employee: newEmployeeInput,
    })

    expect(result).toEqual({ reason: "employee_code_conflict" })
  })

  test("rejects a password shorter than 8 characters with weak_password", async () => {
    const context = createTestContext().context

    const result = await new RegisterEmployee(context).run({
      viewerRole: "admin",
      employee: { ...newEmployeeInput, password: "short7!" },
    })

    expect(result).toEqual({ reason: "weak_password" })
  })
})

describe("GetEmployee", () => {
  test("returns the employee by code", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E901")

    const result = await new GetEmployee(context).run({ code: "E901" })

    expect(result).toBeInstanceOf(Employee)
  })

  test("returns employee_not_found for an unknown code", async () => {
    const context = createTestContext().context

    const result = await new GetEmployee(context).run({ code: "E999" })

    expect(result).toEqual({ reason: "employee_not_found" })
  })
})

const profileInput = {
  name: "Renamed",
  email: "you+renamed@example.com",
  role: "manager",
  deptId: 4,
  deptName: "Sales",
  position: "Lead",
  status: "leave" as const,
}

describe("UpdateEmployee", () => {
  test("updates the profile for a privileged role", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E902")

    const result = await new UpdateEmployee(context).run({
      viewerRole: "admin",
      code: "E902",
      profile: profileInput,
    })

    expect(result).toBeInstanceOf(Employee)

    if (result instanceof Error || "reason" in result) {
      throw new Error("update failed")
    }

    expect(result.name).toBe("Renamed")
    expect(result.role).toBe("manager")
    expect(result.status).toBe("leave")
  })

  test("rejects a non privileged role with forbidden", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E903")

    const result = await new UpdateEmployee(context).run({
      viewerRole: "member",
      code: "E903",
      profile: profileInput,
    })

    expect(result).toEqual({ reason: "forbidden" })
  })

  test("rejects an unknown code with employee_not_found", async () => {
    const context = createTestContext().context

    const result = await new UpdateEmployee(context).run({
      viewerRole: "admin",
      code: "E999",
      profile: profileInput,
    })

    expect(result).toEqual({ reason: "employee_not_found" })
  })
})

describe("DeleteEmployee", () => {
  test("deletes an employee for a privileged role", async () => {
    const context = createTestContext().context

    const id = await seedEmployee(context, "E904")

    const result = await new DeleteEmployee(context).run({
      viewerRole: "admin",
      viewerEmployeeId: id + 1,
      code: "E904",
    })

    expect(result).toEqual({ reason: "deleted" })

    const found = await new EmployeeRepository(context).findByCode("E904")

    expect(found).toBeNull()
  })

  test("rejects deleting your own account with self_delete", async () => {
    const context = createTestContext().context

    const id = await seedEmployee(context, "E905")

    const result = await new DeleteEmployee(context).run({
      viewerRole: "admin",
      viewerEmployeeId: id,
      code: "E905",
    })

    expect(result).toEqual({ reason: "self_delete" })
  })

  test("rejects a non privileged role with forbidden", async () => {
    const context = createTestContext().context

    const id = await seedEmployee(context, "E906")

    const result = await new DeleteEmployee(context).run({
      viewerRole: "member",
      viewerEmployeeId: id + 1,
      code: "E906",
    })

    expect(result).toEqual({ reason: "forbidden" })
  })

  test("rejects an unknown code with employee_not_found", async () => {
    const context = createTestContext().context

    const result = await new DeleteEmployee(context).run({
      viewerRole: "admin",
      viewerEmployeeId: 1,
      code: "E999",
    })

    expect(result).toEqual({ reason: "employee_not_found" })
  })

  test("deletes related records across all dependent tables", async () => {
    const { context, db } = createTestContext()

    const id = await seedEmployee(context, "E910")

    // 代表的な関連テーブルにレコードを挿入する
    await db
      .prepare(
        "INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, status, created_at) VALUES (?1, 'annual', '2026-01-01', '2026-01-02', 1, 'pending', '2026-01-01T00:00:00Z')",
      )
      .bind(id)
      .run()

    await db
      .prepare(
        "INSERT INTO leave_balances (employee_id, fiscal_year, leave_type, granted_days, used_days, remaining_days) VALUES (?1, '2026', 'annual', 20, 0, 20)",
      )
      .bind(id)
      .run()

    await db
      .prepare(
        "INSERT INTO attendance_records (employee_id, work_date, status) VALUES (?1, '2026-01-01', 'present')",
      )
      .bind(id)
      .run()

    await db
      .prepare(
        "INSERT INTO notifications (recipient_employee_id, source_domain, kind, title, created_at) VALUES (?1, 'leave', 'approved', 'Your leave was approved', '2026-01-01T00:00:00Z')",
      )
      .bind(id)
      .run()

    await db
      .prepare(
        "INSERT INTO goals (id, employee_id, period, title, weight, status) VALUES (1, ?1, '2026-H1', 'Goal 1', 100, 'open')",
      )
      .bind(id)
      .run()

    await db
      .prepare(
        "INSERT INTO goal_evaluations (id, goal_id, evaluator_id, kind, score, created_at) VALUES (1, 1, ?1, 'self', 5, '2026-01-01T00:00:00Z')",
      )
      .bind(id)
      .run()

    await db
      .prepare("INSERT INTO shift_assignments (employee_id, date) VALUES (?1, '2026-01-01')")
      .bind(id)
      .run()

    await db
      .prepare(
        "INSERT INTO payslips (employee_id, period, base_salary, allowances, deductions, net_pay, status) VALUES (?1, '2026-01', 300000, 50000, 30000, 320000, 'issued')",
      )
      .bind(id)
      .run()

    await db
      .prepare(
        "INSERT INTO career_sheets (employee_id, updated_at) VALUES (?1, '2026-01-01T00:00:00Z')",
      )
      .bind(id)
      .run()

    await db
      .prepare(
        "INSERT INTO training_courses (id, code, title, category, is_required, status) VALUES (1, 'TC001', 'Intro', 'general', 0, 'active')",
      )
      .run()

    await db
      .prepare(
        "INSERT INTO training_enrollments (course_id, employee_id, status) VALUES (1, ?1, 'enrolled')",
      )
      .bind(id)
      .run()

    await db
      .prepare("INSERT INTO org_memberships (department_code, employee_code) VALUES ('D001', ?1)")
      .bind("E910")
      .run()

    await db
      .prepare(
        "INSERT INTO skills (code, name, category) VALUES ('typescript', 'TypeScript', 'programming')",
      )
      .run()

    await db
      .prepare(
        "INSERT INTO employee_skills (employee_id, skill_code, level) VALUES (?1, 'typescript', 3)",
      )
      .bind(id)
      .run()

    // 従業員を削除
    const result = await new DeleteEmployee(context).run({
      viewerRole: "admin",
      viewerEmployeeId: id + 1,
      code: "E910",
    })

    expect(result).toEqual({ reason: "deleted" })

    // 関連レコードが削除されていることを確認
    const leaveCount = await db
      .prepare("SELECT COUNT(*) as c FROM leave_requests WHERE employee_id = ?1")
      .bind(id)
      .first("c")
    expect(leaveCount).toBe(0)

    const balanceCount = await db
      .prepare("SELECT COUNT(*) as c FROM leave_balances WHERE employee_id = ?1")
      .bind(id)
      .first("c")
    expect(balanceCount).toBe(0)

    const attendanceCount = await db
      .prepare("SELECT COUNT(*) as c FROM attendance_records WHERE employee_id = ?1")
      .bind(id)
      .first("c")
    expect(attendanceCount).toBe(0)

    const notifCount = await db
      .prepare("SELECT COUNT(*) as c FROM notifications WHERE recipient_employee_id = ?1")
      .bind(id)
      .first("c")
    expect(notifCount).toBe(0)

    const goalCount = await db
      .prepare("SELECT COUNT(*) as c FROM goals WHERE employee_id = ?1")
      .bind(id)
      .first("c")
    expect(goalCount).toBe(0)

    const evalCount = await db
      .prepare("SELECT COUNT(*) as c FROM goal_evaluations WHERE goal_id = 1")
      .first("c")
    expect(evalCount).toBe(0)

    const shiftCount = await db
      .prepare("SELECT COUNT(*) as c FROM shift_assignments WHERE employee_id = ?1")
      .bind(id)
      .first("c")
    expect(shiftCount).toBe(0)

    const payslipCount = await db
      .prepare("SELECT COUNT(*) as c FROM payslips WHERE employee_id = ?1")
      .bind(id)
      .first("c")
    expect(payslipCount).toBe(0)

    const careerSheetCount = await db
      .prepare("SELECT COUNT(*) as c FROM career_sheets WHERE employee_id = ?1")
      .bind(id)
      .first("c")
    expect(careerSheetCount).toBe(0)

    const enrollmentCount = await db
      .prepare("SELECT COUNT(*) as c FROM training_enrollments WHERE employee_id = ?1")
      .bind(id)
      .first("c")
    expect(enrollmentCount).toBe(0)

    const orgMemberCount = await db
      .prepare("SELECT COUNT(*) as c FROM org_memberships WHERE employee_code = ?1")
      .bind("E910")
      .first("c")
    expect(orgMemberCount).toBe(0)

    const skillCount = await db
      .prepare("SELECT COUNT(*) as c FROM employee_skills WHERE employee_id = ?1")
      .bind(id)
      .first("c")
    expect(skillCount).toBe(0)

    // 従業員本体も削除されていることを確認
    const found = await new EmployeeRepository(context).findByCode("E910")
    expect(found).toBeNull()
  })
})
