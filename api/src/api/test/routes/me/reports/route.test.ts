import { describe, expect, test } from "bun:test"
import { seedDepartments } from "@/contexts/company/infrastructure/seed/seed-departments"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedOrgDepartments } from "@/contexts/company/infrastructure/seed/seed-org-departments"
import { seedOrgMemberships } from "@/contexts/company/infrastructure/seed/seed-org-memberships"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const myReportResponseSchema = z.object({
  data: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      dept_name: z.string().nullable(),
      position: z.string().nullable(),
    }),
  ),
})

const jwtSecret = "me-reports-route-test-secret"

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
    [
      ...seedOrgMemberships,
      // E017(status: leave) を E002 配下に置き、active フィルタが効くことを検証可能にする。
      { departmentCode: "D002", employeeCode: "E017", managerEmployeeCode: "E002" },
    ].map((membership) => ({
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

  return db
}

function tokenFor(employeeId: number, code: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+${code.toLowerCase()}@example.com`,
    role: "member",
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /me/reports", () => {
  test("returns active direct reports as { data } with code/name/dept_name/position", async () => {
    // E001 は E002・E004・E009 の直属 manager。
    const response = await request("/me/reports", await tokenFor(1, "E001"))

    expect(response.status).toBe(200)

    const parsed = myReportResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const codes = parsed.data.data.map((report) => report.code)

      expect(codes).toEqual(["E002", "E004", "E009"])

      const first = parsed.data.data.find((report) => report.code === "E002")

      expect(first?.name).toBe("Blake Morgan")
      expect(first?.dept_name).toBe("人事部")
      expect(first?.position).toBe("人事マネージャー")
    }
  })

  test("excludes non-active reports", async () => {
    // E002 の直属は E003(active) と E017(leave)。leave は除外される。
    const response = await request("/me/reports", await tokenFor(2, "E002"))

    expect(response.status).toBe(200)

    const parsed = myReportResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const codes = parsed.data.data.map((report) => report.code)

      expect(codes).toEqual(["E003"])
    }
  })

  test("returns an empty array for an employee with no reports", async () => {
    const response = await request("/me/reports", await tokenFor(5, "E005"))

    expect(response.status).toBe(200)

    const parsed = myReportResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data).toEqual([])
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/me/reports", null)

    expect(response.status).toBe(401)
  })
})
