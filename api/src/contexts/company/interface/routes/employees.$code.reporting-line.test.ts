import { describe, expect, test } from "bun:test"
import { seedDepartments } from "@/contexts/company/infrastructure/seed/seed-departments.repository"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees.repository"
import { seedOrgDepartments } from "@/contexts/company/infrastructure/seed/seed-org-departments.repository"
import { seedOrgMemberships } from "@/contexts/company/infrastructure/seed/seed-org-memberships.repository"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { verifyStandardCompanyMigration } from "@/api/test/support/verify-standard-company-migration"
import { z } from "zod"

const reportingLineNodeResponseSchema = z.object({
  employee_code: z.string(),
  employee_name: z.string(),
  department_code: z.string().nullable(),
  position: z.string().nullable(),
  depth: z.number(),
})

const jwtSecret = "org-reporting-line-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "departments",
    seedDepartments.map((department) => ({ id: department.id, name: department.name })),
  )

  await seedD1(
    db,
    "org_departments",
    seedOrgDepartments.map((department) => ({
      code: department.code,
      department_id: department.departmentId,
      parent_code: department.parentCode,
      manager_employee_code: department.managerEmployeeCode,
      sort_order: department.order,
    })),
  )

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

  await verifyStandardCompanyMigration(db)

  return db
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /employees/:code/reporting-line", () => {
  test("returns 200 with the chain ordered from subject to top", async () => {
    const response = await request("/employees/E005/reporting-line", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z.array(reportingLineNodeResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.map((node) => node.employee_code)).toEqual(["E005", "E004", "E001"])
      expect(parsed.data.map((node) => node.depth)).toEqual([0, 1, 2])
    }
  })

  test("returns 404 when the employee has no membership", async () => {
    const response = await request("/employees/E999/reporting-line", await memberToken())

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/employees/E005/reporting-line", null)

    expect(response.status).toBe(401)
  })
})
