import { DeleteEmployee } from "@/application/employee/delete-employee"
import { GetEmployee } from "@/application/employee/get-employee"
import { RegisterEmployee } from "@/application/employee/register-employee"
import { UpdateEmployee } from "@/application/employee/update-employee"
import { Employee } from "@/domain/employee/employee.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors"
import { expectApplicationError } from "@/interface/shared/test/expect-application-error"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"

async function seedEmployee(
  context: Context,
  code: string,
  options: { role?: string; status?: "active" | "leave" | "retired" } = {},
): Promise<number> {
  const repository = new EmployeeRepository(context)

  const created = await repository.create({
    code: code,
    name: "Sam Rivers",
    deptId: 3,
    deptName: "Engineering",
    position: "Engineer",
    status: options.status ?? "active",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

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
      session: makeTestSession("admin"),
      employee: newEmployeeInput,
    })

    expect(result).toBeInstanceOf(Employee)

    if (result instanceof ApplicationError) {
      throw new Error("register failed")
    }

    expect(result.code).toBe("E900")
    expect(result.deptName).toBe("Engineering")
  })

  test("rejects a non privileged role with forbidden", async () => {
    const context = createTestContext().context

    const result = await new RegisterEmployee(context).run({
      session: makeTestSession("member"),
      employee: newEmployeeInput,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects a duplicate code with employee_code_conflict", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E900")

    const result = await new RegisterEmployee(context).run({
      session: makeTestSession("admin"),
      employee: newEmployeeInput,
    })

    expectApplicationError(result, ConflictError, "employee_code_conflict")
  })

  test("rejects a password shorter than 8 characters with weak_password", async () => {
    const context = createTestContext().context

    const result = await new RegisterEmployee(context).run({
      session: makeTestSession("admin"),
      employee: { ...newEmployeeInput, password: "short7!" },
    })

    expectApplicationError(result, ValidationError, "weak_password")
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

    expectApplicationError(result, NotFoundError, "employee_not_found")
  })
})

const profileInput = {
  name: "Renamed",
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
      session: makeTestSession("admin"),
      viewerEmployeeId: 0,
      code: "E902",
      profile: profileInput,
    })

    expect(result).toBeInstanceOf(Employee)

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.name).toBe("Renamed")
    expect(result.status).toBe("leave")
  })

  test("rejects a non privileged role with forbidden", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E903")

    const result = await new UpdateEmployee(context).run({
      session: makeTestSession("member"),
      viewerEmployeeId: 0,
      code: "E903",
      profile: profileInput,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects an unknown code with employee_not_found", async () => {
    const context = createTestContext().context

    const result = await new UpdateEmployee(context).run({
      session: makeTestSession("admin"),
      viewerEmployeeId: 0,
      code: "E999",
      profile: profileInput,
    })

    expectApplicationError(result, NotFoundError, "employee_not_found")
  })

  test("rejects retiring the last login-enabled admin with last_admin", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E908", { role: "admin" })

    const result = await new UpdateEmployee(context).run({
      session: makeTestSession("admin"),
      viewerEmployeeId: 0,
      code: "E908",
      profile: { ...profileInput, status: "retired" },
    })

    expectApplicationError(result, ConflictError, "last_admin")

    const found = await new EmployeeRepository(context).findByCode("E908")
    expect(found).toBeInstanceOf(Employee)

    if (found instanceof Employee) {
      expect(found.status).toBe("active")
    }
  })

  test("allows retiring an admin when another login-enabled admin remains", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E909", { role: "admin" })
    await seedEmployee(context, "E919", { role: "admin" })

    const result = await new UpdateEmployee(context).run({
      session: makeTestSession("admin"),
      viewerEmployeeId: 0,
      code: "E909",
      profile: { ...profileInput, status: "retired" },
    })

    expect(result).toBeInstanceOf(Employee)

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.status).toBe("retired")
  })
})

describe("DeleteEmployee", () => {
  test("deletes an employee for a privileged role", async () => {
    const context = createTestContext().context

    const id = await seedEmployee(context, "E904")

    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("admin"),
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
      session: makeTestSession("admin"),
      viewerEmployeeId: id,
      code: "E905",
    })

    expectApplicationError(result, ForbiddenError, "self_delete")
  })

  test("rejects deleting the last login-enabled admin with last_admin", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E912", { role: "admin" })
    const hrId = await seedEmployee(context, "E913", { role: "hr" })

    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("hr", hrId),
      viewerEmployeeId: hrId,
      code: "E912",
    })

    expectApplicationError(result, ConflictError, "last_admin")

    const found = await new EmployeeRepository(context).findByCode("E912")
    expect(found).toBeInstanceOf(Employee)
  })

  test("allows deleting an admin when another login-enabled admin remains", async () => {
    const context = createTestContext().context

    const deleteTargetId = await seedEmployee(context, "E914", { role: "admin" })
    const viewerId = await seedEmployee(context, "E915", { role: "admin" })

    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("admin", viewerId),
      viewerEmployeeId: viewerId,
      code: "E914",
    })

    expect(result).toEqual({ reason: "deleted" })

    const found = await new EmployeeRepository(context).findByCode("E914")
    expect(found).toBeNull()
    expect(deleteTargetId).not.toBe(viewerId)
  })

  test("rejects a non privileged role with forbidden", async () => {
    const context = createTestContext().context

    const id = await seedEmployee(context, "E906")

    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("member"),
      viewerEmployeeId: id + 1,
      code: "E906",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects manager role with forbidden (delete is hr/admin only)", async () => {
    const context = createTestContext().context

    const id = await seedEmployee(context, "E907")

    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("manager"),
      viewerEmployeeId: id + 1,
      code: "E907",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects an unknown code with employee_not_found", async () => {
    const context = createTestContext().context

    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("admin"),
      viewerEmployeeId: 1,
      code: "E999",
    })

    expectApplicationError(result, NotFoundError, "employee_not_found")
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
      session: makeTestSession("admin"),
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

  test("deletes approver/evaluator orphan records when the referenced employee is deleted", async () => {
    const { context, db } = createTestContext()

    // 社員 A（削除対象）と社員 B（残存）を作成
    const idA = await seedEmployee(context, "EA01")
    const idB = await seedEmployee(context, "EB01")

    // --- 社員 B の目標に対して社員 A が評価者 ---
    await db
      .prepare(
        "INSERT INTO goals (id, employee_id, period, title, weight, status) VALUES (10, ?1, '2026-H1', 'B Goal', 100, 'open')",
      )
      .bind(idB)
      .run()

    await db
      .prepare(
        "INSERT INTO goal_evaluations (id, goal_id, evaluator_id, kind, score, created_at) VALUES (10, 10, ?1, 'manager', 4, '2026-01-01T00:00:00Z')",
      )
      .bind(idA)
      .run()

    // --- 社員 B の経費に対して社員 A が承認者 ---
    await db
      .prepare(
        "INSERT INTO expenses (id, employee_id, category, amount, spent_at, status, created_at) VALUES (10, ?1, 'transport', 1000, '2026-01-01', 'approved', '2026-01-01T00:00:00Z')",
      )
      .bind(idB)
      .run()

    await db
      .prepare(
        "INSERT INTO expense_approvals (id, expense_id, approver_id, action, created_at) VALUES (10, 10, ?1, 'approve', '2026-01-01T00:00:00Z')",
      )
      .bind(idA)
      .run()

    // --- 社員 B の申請に対して社員 A が承認者 ---
    await db
      .prepare(
        "INSERT INTO application_templates (id, code, name, category, schema_json, approver_roles) VALUES (1, 'TPL01', 'Test', 'general', '[]', '[\"admin\"]')",
      )
      .run()

    await db
      .prepare(
        "INSERT INTO applications (id, template_id, applicant_id, status, payload, created_at) VALUES (10, 1, ?1, 'approved', '{}', '2026-01-01T00:00:00Z')",
      )
      .bind(idB)
      .run()

    await db
      .prepare(
        "INSERT INTO application_approvals (id, application_id, approver_id, action, created_at) VALUES (10, 10, ?1, 'approve', '2026-01-01T00:00:00Z')",
      )
      .bind(idA)
      .run()

    // --- 社員 B の休暇申請で社員 A が承認者（nullable FK） ---
    await db
      .prepare(
        "INSERT INTO leave_requests (id, employee_id, leave_type, start_date, end_date, days, status, approver_id, created_at) VALUES (10, ?1, 'annual', '2026-02-01', '2026-02-02', 1, 'approved', ?2, '2026-01-01T00:00:00Z')",
      )
      .bind(idB, idA)
      .run()

    // --- org_memberships で社員 A がマネージャー（nullable FK） ---
    await db
      .prepare(
        "INSERT INTO org_memberships (department_code, employee_code, manager_employee_code) VALUES ('D002', ?1, ?2)",
      )
      .bind("EB01", "EA01")
      .run()

    // 社員 A を削除
    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("admin"),
      viewerEmployeeId: idB,
      code: "EA01",
    })

    expect(result).toEqual({ reason: "deleted" })

    // 社員 A が評価者の goal_evaluations が削除されている
    const evalCount = await db
      .prepare("SELECT COUNT(*) as c FROM goal_evaluations WHERE evaluator_id = ?1")
      .bind(idA)
      .first("c")
    expect(evalCount).toBe(0)

    // 社員 B の目標自体は残っている
    const goalCount = await db
      .prepare("SELECT COUNT(*) as c FROM goals WHERE employee_id = ?1")
      .bind(idB)
      .first("c")
    expect(goalCount).toBe(1)

    // 社員 A が承認者の expense_approvals が削除されている
    const expApprovalCount = await db
      .prepare("SELECT COUNT(*) as c FROM expense_approvals WHERE approver_id = ?1")
      .bind(idA)
      .first("c")
    expect(expApprovalCount).toBe(0)

    // 社員 B の経費自体は残っている
    const expenseCount = await db
      .prepare("SELECT COUNT(*) as c FROM expenses WHERE employee_id = ?1")
      .bind(idB)
      .first("c")
    expect(expenseCount).toBe(1)

    // 社員 A が承認者の application_approvals が削除されている
    const appApprovalCount = await db
      .prepare("SELECT COUNT(*) as c FROM application_approvals WHERE approver_id = ?1")
      .bind(idA)
      .first("c")
    expect(appApprovalCount).toBe(0)

    // 社員 B の申請自体は残っている
    const appCount = await db
      .prepare("SELECT COUNT(*) as c FROM applications WHERE applicant_id = ?1")
      .bind(idB)
      .first("c")
    expect(appCount).toBe(1)

    // leave_requests.approver_id が NULL に更新されている
    const leaveApprover = await db
      .prepare("SELECT approver_id FROM leave_requests WHERE id = 10")
      .first("approver_id")
    expect(leaveApprover).toBeNull()

    // org_memberships.manager_employee_code が NULL に更新されている
    const manager = await db
      .prepare(
        "SELECT manager_employee_code FROM org_memberships WHERE department_code = 'D002' AND employee_code = 'EB01'",
      )
      .first("manager_employee_code")
    expect(manager).toBeNull()
  })

  test("deletes employee atomically within a single batch (no separate delete call)", async () => {
    const { context, db } = createTestContext()

    const id = await seedEmployee(context, "E911")

    // 関連レコードを1つ挿入して、batch が実行されることを確認する
    await db
      .prepare(
        "INSERT INTO leave_balances (employee_id, fiscal_year, leave_type, granted_days, used_days, remaining_days) VALUES (?1, '2026', 'annual', 20, 0, 20)",
      )
      .bind(id)
      .run()

    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("admin"),
      viewerEmployeeId: id + 1,
      code: "E911",
    })

    expect(result).toEqual({ reason: "deleted" })

    // 従業員本体が batch 内で削除されていることを確認
    const found = await new EmployeeRepository(context).findByCode("E911")
    expect(found).toBeNull()

    // 関連レコードも削除されている
    const balanceCount = await db
      .prepare("SELECT COUNT(*) as c FROM leave_balances WHERE employee_id = ?1")
      .bind(id)
      .first("c")
    expect(balanceCount).toBe(0)
  })

  test("deletes IAM records (accounts/identities/account_roles/refresh_tokens) with the employee", async () => {
    const { context, db } = createTestContext()

    // role 付きで seed すると accounts/identities/account_roles が作られる（account.id = employee.id）
    const id = await seedEmployee(context, "E920", { role: "member" })

    // refresh_tokens は seed されないため直接挿入する
    await db
      .prepare(
        `INSERT INTO refresh_tokens (id, account_id, token_hash, family_id, token_version, expires_at, created_at)
         VALUES (1, ?1, 'hash-e920', 'family-e920', 0, 9999999999, 0)`,
      )
      .bind(id)
      .run()

    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("admin"),
      viewerEmployeeId: id + 1000,
      code: "E920",
    })

    expect(result).toEqual({ reason: "deleted" })

    const accountCount = await db
      .prepare("SELECT COUNT(*) as c FROM accounts WHERE employee_id = ?1")
      .bind(id)
      .first("c")
    expect(accountCount).toBe(0)

    const identityCount = await db
      .prepare("SELECT COUNT(*) as c FROM identities WHERE account_id = ?1")
      .bind(id)
      .first("c")
    expect(identityCount).toBe(0)

    const accountRoleCount = await db
      .prepare("SELECT COUNT(*) as c FROM account_roles WHERE account_id = ?1")
      .bind(id)
      .first("c")
    expect(accountRoleCount).toBe(0)

    const refreshTokenCount = await db
      .prepare("SELECT COUNT(*) as c FROM refresh_tokens WHERE account_id = ?1")
      .bind(id)
      .first("c")
    expect(refreshTokenCount).toBe(0)
  })

  test("allows re-registering the same code after deletion (no orphan account conflict)", async () => {
    const { context } = createTestContext()

    // 従業員を IAM 付きで登録
    const registered = await new RegisterEmployee(context).run({
      session: makeTestSession("admin"),
      employee: { ...newEmployeeInput, code: "E921", email: "you+e921@example.com" },
    })

    if (registered instanceof ApplicationError) {
      throw new Error("register failed")
    }

    // 削除（viewer は削除対象と別人にする）
    const deleted = await new DeleteEmployee(context).run({
      session: makeTestSession("admin"),
      viewerEmployeeId: registered.id + 1000,
      code: "E921",
    })

    expect(deleted).toEqual({ reason: "deleted" })

    // 同じ code で再登録できる（孤児 account による employee_id UNIQUE 衝突が起きない）
    const reRegistered = await new RegisterEmployee(context).run({
      session: makeTestSession("admin"),
      employee: { ...newEmployeeInput, code: "E921", email: "you+e921b@example.com" },
    })

    expect(reRegistered).toBeInstanceOf(Employee)
  })

  test("nullifies thanks_redemptions.decider_id when the decider employee is deleted", async () => {
    const { context, db } = createTestContext()

    // 社員 A（削除対象：決裁者）と社員 B（申請者：残存）を作成
    const idA = await seedEmployee(context, "EA02")
    const idB = await seedEmployee(context, "EB02")

    // thanks_rewards マスタを用意
    await db
      .prepare(
        "INSERT INTO thanks_rewards (id, name, point_cost, is_active, created_at) VALUES (1, 'Gift Card', 100, 1, '2026-01-01T00:00:00Z')",
      )
      .run()

    // 社員 B の交換申請を社員 A が決裁した状態
    await db
      .prepare(
        "INSERT INTO thanks_redemptions (id, employee_id, reward_id, point_cost, status, created_at, decided_at, decider_id) VALUES (1, ?1, 1, 100, 'fulfilled', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', ?2)",
      )
      .bind(idB, idA)
      .run()

    // 社員 A を削除
    const result = await new DeleteEmployee(context).run({
      session: makeTestSession("admin"),
      viewerEmployeeId: idB,
      code: "EA02",
    })

    expect(result).toEqual({ reason: "deleted" })

    // thanks_redemptions.decider_id が NULL に更新されている
    const deciderId = await db
      .prepare("SELECT decider_id FROM thanks_redemptions WHERE id = 1")
      .first("decider_id")
    expect(deciderId).toBeNull()

    // 社員 B の交換申請レコード自体は残っている
    const redemptionCount = await db
      .prepare("SELECT COUNT(*) as c FROM thanks_redemptions WHERE employee_id = ?1")
      .bind(idB)
      .first("c")
    expect(redemptionCount).toBe(1)
  })
})
