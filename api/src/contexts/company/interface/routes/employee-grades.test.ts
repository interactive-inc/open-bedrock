import { describe, expect, test } from "bun:test"
import { seedGrades } from "@/contexts/company/infrastructure/seed/seed-grades"
import { seedEmployeeGrades } from "@/contexts/company/infrastructure/seed/seed-employee-grades"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedOrgMemberships } from "@/contexts/company/infrastructure/seed/seed-org-memberships"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { verifyStandardCompanyMigration } from "@/api/test/support/verify-standard-company-migration"
import { z } from "zod"

const assignmentResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  grade_id: z.number(),
  effective_date: z.string(),
  reason: z.string().nullable(),
  created_at: z.string(),
})

const jwtSecret = "grade-assignments-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  await seedD1(
    db,
    "org_memberships",
    seedOrgMemberships.map((membership) => ({
      department_code: membership.departmentCode,
      employee_code: membership.employeeCode,
      manager_employee_code: membership.managerEmployeeCode,
    })),
  )

  await seedD1(
    db,
    "grade_definitions",
    seedGrades.map((grade) => ({
      id: grade.id,
      code: grade.code,
      name: grade.name,
      rank: grade.rank,
      description: grade.description,
      created_at: grade.createdAt,
    })),
  )

  await seedD1(
    db,
    "employee_grades",
    seedEmployeeGrades.map((assignment) => ({
      id: assignment.id,
      employee_id: assignment.employeeId,
      grade_id: assignment.gradeId,
      effective_date: assignment.effectiveDate,
      reason: assignment.reason,
      created_at: assignment.createdAt,
    })),
  )

  await verifyStandardCompanyMigration(db)

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

describe("GET /employee-grades", () => {
  test("returns 200 with the viewer's own history by default (desc by effective_date)", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(assignmentResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)
      expect(parsed.data.data.map((row) => row.effective_date)).toEqual([
        "2026-04-01",
        "2025-04-01",
      ])
    }
  })

  test("grade:read:all can read another employee's history", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades?employee_id=5",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(assignmentResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((row) => row.employee_id === 5)).toBe(true)
    }
  })

  test("resolves employee_code to id (E005 own history)", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades?employee_code=E005",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(assignmentResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((row) => row.employee_id === 5)).toBe(true)
    }
  })

  test("unknown employee_code is 404", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades?employee_code=E999",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(404)
  })

  test("manager can read a report's history via grade:read:reports (E004 over E005)", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades?employee_id=5",
      token: await tokenFor(4, "manager"),
    })

    expect(response.status).toBe(200)
  })

  test("manager cannot read a non-report's history (E004 not over E009)", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades?employee_id=9",
      token: await tokenFor(4, "manager"),
    })

    expect(response.status).toBe(403)
  })

  test("member requesting another employee_id is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades?employee_id=9",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /employee-grades", () => {
  test("grade:manage can record an assignment", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { employee_id: 9, grade_id: 2, effective_date: "2026-04-01", reason: "Promotion" },
    })

    expect(response.status).toBe(201)

    const parsed = assignmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(9)
      expect(parsed.data.grade_id).toBe(2)
    }
  })

  test("member without grade:manage is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { employee_id: 5, grade_id: 1, effective_date: "2027-04-01" },
    })

    expect(response.status).toBe(403)
  })

  test("unknown grade is 404", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { employee_id: 9, grade_id: 999, effective_date: "2026-04-01" },
    })

    expect(response.status).toBe(404)
  })

  test("duplicate employee_id + effective_date is a conflict", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-grades",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { employee_id: 5, grade_id: 1, effective_date: "2025-04-01" },
    })

    expect(response.status).toBe(409)
  })
})
