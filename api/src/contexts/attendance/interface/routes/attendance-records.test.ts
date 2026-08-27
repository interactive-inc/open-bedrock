import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedAttendanceRecords } from "@/contexts/attendance/test/seed/seed-attendance-records.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedOrgMemberships } from "@tests/api/support/company/seed-org-memberships.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import {
  initializeCompanyMembershipTestState,
  initializeStandardCompanyTestState,
} from "@tests/api/support/initialize-standard-company-test-state"
import { initializeCompanyTestFixture } from "@tests/api/support/initialize-company-test-fixture"
import { z } from "zod"

const jwtSecret = "attendance-list-route-test-secret"

const attendanceRecordResponseSchema = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  work_date: z.string(),
  clock_in_at: z.string().nullable(),
  clock_out_at: z.string().nullable(),
  work_minutes: z.number().nullable(),
  status: z.string(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  await initializeCompanyMembershipTestState(
    db,
    seedOrgMemberships.map((membership) => ({
      departmentCode: membership.departmentCode,
      employeeCode: membership.employeeCode,
      managerEmployeeCode: membership.managerEmployeeCode,
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

  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
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
      "/attendance/attendance-records?employee_id=5",
      await tokenFor(1),
    )

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.total).toBe(2)
      expect(
        parsed.data.data.every((record) => record.employee_id === toWorkforceEmployeeId(5)),
      ).toBe(true)
    }
  })

  test("member requesting another employee_id is forbidden", async () => {
    const response = await getRequest(
      "/attendance/attendance-records?employee_id=9",
      await tokenFor(5),
    )

    expect(response.status).toBe(403)
  })

  test("manager can read a report's attendance (E004 over E005)", async () => {
    const response = await getRequest(
      "/attendance/attendance-records?employee_id=5",
      await tokenFor(4),
    )

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(
        parsed.data.data.every((record) => record.employee_id === toWorkforceEmployeeId(5)),
      ).toBe(true)
    }
  })

  test("manager cannot read a non-report's attendance (E004 not over E009)", async () => {
    const response = await getRequest(
      "/attendance/attendance-records?employee_id=9",
      await tokenFor(4),
    )

    expect(response.status).toBe(403)
  })

  test("returns 400 when from is not a valid date format", async () => {
    const response = await getRequest("/attendance/attendance-records?from=aaa", await tokenFor(1))

    expect(response.status).toBe(400)
  })

  test("returns 400 when to is not a valid date format", async () => {
    const response = await getRequest(
      "/attendance/attendance-records?to=2026/06/01",
      await tokenFor(1),
    )

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest("/attendance/attendance-records", null)

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

  await seedCompanyEmployees(
    db,
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.code,
      deptId: employee.departmentId,
      deptName: "Dept",
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

  await seedD1(db, "attendance_records", [
    {
      id: 100,
      employee_id: "20",
      work_date: "2026-06-01",
      clock_in_at: "2026-06-01T09:00:00Z",
      clock_out_at: "2026-06-01T18:00:00Z",
      work_minutes: 480,
      status: "closed",
    },
    {
      id: 101,
      employee_id: "21",
      work_date: "2026-06-01",
      clock_in_at: "2026-06-01T09:00:00Z",
      clock_out_at: "2026-06-01T18:00:00Z",
      work_minutes: 480,
      status: "closed",
    },
  ])

  await initializeCompanyTestFixture({
    db,
    employees: scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.code,
      deptId: employee.departmentId,
      status: "active",
    })),
    departments: [
      { id: 1, code: "D001", name: "Dept One", managerEmployeeCode: "M002" },
      { id: 2, code: "D002", name: "Dept Two", managerEmployeeCode: "S022" },
    ],
    memberships: [
      { departmentCode: "D001", employeeCode: "M002", managerEmployeeCode: null },
      { departmentCode: "D001", employeeCode: "R020", managerEmployeeCode: "M002" },
      { departmentCode: "D001", employeeCode: "R021", managerEmployeeCode: "M002" },
      { departmentCode: "D002", employeeCode: "S022", managerEmployeeCode: null },
    ],
  })

  return db
}

describe("GET /attendance-records?scope=reports", () => {
  test("manager gets attendance of all reports (2 employees)", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/attendance/attendance-records?scope=reports",
      token: await tokenFor(2),
    })

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)

      const employeeIds = parsed.data.data
        .map((record) => record.employee_id)
        .sort((left, right) => left.localeCompare(right))

      expect(employeeIds).toEqual([toWorkforceEmployeeId(20), toWorkforceEmployeeId(21)])
    }
  })

  test("manager with no reports gets an empty list", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/attendance/attendance-records?scope=reports",
      token: await tokenFor(22),
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
      path: "/attendance/attendance-records?scope=reports",
      token: await tokenFor(20),
    })

    expect(response.status).toBe(403)
  })
})
