import { describe, expect, test } from "bun:test"
import { seedAttendanceRecords } from "@/contexts/attendance/infrastructure/seed/seed-attendance-records.repository"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees.repository"
import { seedOrgMemberships } from "@/contexts/company/infrastructure/seed/seed-org-memberships.repository"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { verifyStandardCompanyMigration } from "@/api/test/support/verify-standard-company-migration"
import { verifyCompanyMigrationFixture } from "@/api/test/support/verify-company-migration-fixture"
import { z } from "zod"

const jwtSecret = "attendance-list-route-test-secret"

const attendanceRecordResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  work_date: z.string(),
  clock_in_at: z.string().nullable(),
  clock_out_at: z.string().nullable(),
  work_minutes: z.number().nullable(),
  status: z.string(),
})

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
    "attendance_records",
    seedAttendanceRecords.map((record) => ({
      id: record.id,
      employee_id: record.employeeId,
      work_date: record.workDate,
      clock_in_at: record.clockInAt,
      clock_out_at: record.clockOutAt,
      work_minutes: record.workMinutes,
      status: record.status,
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

async function getRequest(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

const attendanceListResponseSchema = z.object({
  data: z.array(attendanceRecordResponseSchema),
  total: z.number(),
})

describe("GET /attendance-records", () => {
  test("privileged role can read another employee via employee_id", async () => {
    const response = await getRequest(
      "/attendance-records?employee_id=5",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.total).toBe(2)
      expect(parsed.data.data.every((record) => record.employee_id === 5)).toBe(true)
    }
  })

  test("member requesting another employee_id is forbidden", async () => {
    const response = await getRequest(
      "/attendance-records?employee_id=9",
      await tokenFor(5, "member"),
    )

    expect(response.status).toBe(403)
  })

  test("manager can read a report's attendance (E004 over E005)", async () => {
    const response = await getRequest(
      "/attendance-records?employee_id=5",
      await tokenFor(4, "manager"),
    )

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((record) => record.employee_id === 5)).toBe(true)
    }
  })

  test("manager cannot read a non-report's attendance (E004 not over E009)", async () => {
    const response = await getRequest(
      "/attendance-records?employee_id=9",
      await tokenFor(4, "manager"),
    )

    expect(response.status).toBe(403)
  })

  test("returns 400 when from is not a valid date format", async () => {
    const response = await getRequest("/attendance-records?from=aaa", await tokenFor(1, "root"))

    expect(response.status).toBe(400)
  })

  test("returns 400 when to is not a valid date format", async () => {
    const response = await getRequest(
      "/attendance-records?to=2026/06/01",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest("/attendance-records", null)

    expect(response.status).toBe(401)
  })
})

/** scope=reports 用に、manager(id2)が id20/id21 の 2 名を配下に持つ小さな組織を組む。 */
const scopeEmployeeRows = [
  { id: 2, code: "M002", email: "you+m002@example.com", role: "manager", departmentId: 1 },
  { id: 20, code: "R020", email: "you+r020@example.com", role: "member", departmentId: 1 },
  { id: 21, code: "R021", email: "you+r021@example.com", role: "member", departmentId: 1 },
  { id: 22, code: "S022", email: "you+s022@example.com", role: "manager", departmentId: 2 },
]

async function createScopeTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.code,
      dept_id: employee.departmentId,
      dept_name: "Dept",
      position: "-",
      status: "active",
    })),
  )

  await seedIamForEmployees(
    db,
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      email: employee.email,
      passwordHash: "x",
      role: employee.role,
    })),
  )

  await seedD1(db, "org_memberships", [
    { department_code: "D001", employee_code: "M002", manager_employee_code: null },
    { department_code: "D001", employee_code: "R020", manager_employee_code: "M002" },
    { department_code: "D001", employee_code: "R021", manager_employee_code: "M002" },
    { department_code: "D002", employee_code: "S022", manager_employee_code: null },
  ])

  await seedD1(db, "attendance_records", [
    {
      id: 100,
      employee_id: 20,
      work_date: "2026-06-01",
      clock_in_at: "2026-06-01T09:00:00Z",
      clock_out_at: "2026-06-01T18:00:00Z",
      work_minutes: 480,
      status: "closed",
    },
    {
      id: 101,
      employee_id: 21,
      work_date: "2026-06-01",
      clock_in_at: "2026-06-01T09:00:00Z",
      clock_out_at: "2026-06-01T18:00:00Z",
      work_minutes: 480,
      status: "closed",
    },
  ])

  await verifyCompanyMigrationFixture({
    db,
    departments: [
      { id: 1, code: "D001", name: "Dept One", managerEmployeeCode: "M002" },
      { id: 2, code: "D002", name: "Dept Two", managerEmployeeCode: "S022" },
    ],
  })

  return db
}

describe("GET /attendance-records?scope=reports", () => {
  test("manager gets attendance of all reports (2 employees)", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/attendance-records?scope=reports",
      token: await tokenFor(2, "manager"),
    })

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)

      const employeeIds = parsed.data.data.map((record) => record.employee_id).sort((a, b) => a - b)

      expect(employeeIds).toEqual([20, 21])
    }
  })

  test("manager with no reports gets an empty list", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/attendance-records?scope=reports",
      token: await tokenFor(22, "manager"),
    })

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(0)
      expect(parsed.data.data.length).toBe(0)
    }
  })

  test("member requesting scope=reports is forbidden", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/attendance-records?scope=reports",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(403)
  })
})
