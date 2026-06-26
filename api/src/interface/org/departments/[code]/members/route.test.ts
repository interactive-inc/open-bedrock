import { describe, expect, test } from "bun:test"
import { seedDepartments } from "@/infrastructure/seed/seed-departments"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOrgDepartments } from "@/infrastructure/seed/seed-org-departments"
import { seedOrgMemberships } from "@/infrastructure/seed/seed-org-memberships"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const orgMemberResponseSchema = z.object({
  employee_code: z.string(),
  employee_name: z.string(),
  position: z.string().nullable(),
  manager_employee_code: z.string().nullable(),
  is_manager: z.boolean(),
})

const jwtSecret = "org-department-members-route-test-secret"

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
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

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

describe("GET /org/departments/:code/members", () => {
  test("returns 200 with snake_case members and is_manager flag", async () => {
    const response = await request("/org/departments/D003/members", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z.array(orgMemberResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(2)

      const manager = parsed.data.find((member) => member.employee_code === "E004")

      expect(manager?.is_manager).toBe(true)
      expect(manager?.employee_name).toBe("Drew Sato")
      expect(manager?.position).toBe("Engineering Manager")

      const memberE005 = parsed.data.find((member) => member.employee_code === "E005")

      expect(memberE005?.is_manager).toBe(false)
    }
  })

  test("returns 404 for an unknown department code", async () => {
    const response = await request("/org/departments/D999/members", await memberToken())

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/org/departments/D003/members", null)

    expect(response.status).toBe(401)
  })
})
