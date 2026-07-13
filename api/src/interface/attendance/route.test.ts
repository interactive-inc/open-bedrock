import { describe, expect, test } from "bun:test"
import { seedAttendanceRecords } from "@/infrastructure/seed/seed-attendance-records"
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

  await seedD1(db, "attendance_records", [
    ...seedAttendanceRecords.map((record) => ({
      id: record.id,
      employee_id: record.employeeId,
      work_date: record.workDate,
      clock_in_at: record.clockInAt,
      clock_out_at: record.clockOutAt,
      work_minutes: record.workMinutes,
      status: record.status,
    })),
    {
      id: 5,
      employee_id: 4,
      work_date: "2026-05-25",
      clock_in_at: "2026-05-25T09:30:00Z",
      clock_out_at: "2026-05-25T18:00:00Z",
      work_minutes: 510,
      status: "closed",
    },
  ])

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

async function getRequest(
  path: string,
  token: string | null,
  setup?: (db: D1Database) => Promise<void>,
): Promise<Response> {
  const db = await createTestDb()

  if (setup !== undefined) {
    await setup(db)
  }

  return requestWithContext({ db, jwtSecret, path, token })
}

const attendanceListResponseSchema = z.object({
  data: z.array(attendanceRecordResponseSchema),
  total: z.number(),
})

describe("GET /attendance", () => {
  test("privileged role can read another employee via employee_id", async () => {
    const response = await getRequest("/attendance?employee_id=5", await tokenFor(1, "admin"))

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.total).toBe(2)
      expect(parsed.data.data.every((record) => record.employee_id === 5)).toBe(true)
    }
  })

  test("privileged role with no employee_id gets the whole company", async () => {
    const response = await getRequest("/attendance", await tokenFor(1, "admin"))

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(5)
      expect(parsed.data.total).toBe(5)
      expect(new Set(parsed.data.data.map((record) => record.employee_id))).toEqual(
        new Set([4, 5, 9]),
      )
    }
  })

  test("manager can read attendance inside their organization scope", async () => {
    const response = await getRequest("/attendance?employee_id=5", await tokenFor(4, "manager"))

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)
      expect(parsed.data.data.every((record) => record.employee_id === 5)).toBe(true)
    }
  })

  test("attendance:read:all cannot read outside the manager organization scope", async () => {
    const response = await getRequest("/attendance?employee_id=9", await tokenFor(4, "manager"))

    expect(response.status).toBe(403)
  })

  test("org:manage allows a capability holder to read without an organization relationship", async () => {
    const response = await getRequest(
      "/attendance?employee_id=5",
      await tokenFor(17, "hr"),
      async (db) => {
        await db
          .prepare(
            `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
             SELECT 17, id, NULL, 0 FROM roles WHERE key = 'hr'`,
          )
          .run()
      },
    )

    expect(response.status).toBe(200)
  })

  test("organization relationship alone cannot read without attendance:read:all", async () => {
    const response = await getRequest("/attendance?employee_id=10", await tokenFor(9, "member"))

    expect(response.status).toBe(403)
  })

  test("manager list and total use the same self plus managed employee scope", async () => {
    const response = await getRequest("/attendance", await tokenFor(4, "manager"))

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)
      expect(parsed.data.total).toBe(3)
      expect(new Set(parsed.data.data.map((record) => record.employee_id))).toEqual(new Set([4, 5]))
    }
  })

  test("member with no employee_id gets only their own records", async () => {
    const response = await getRequest("/attendance", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // 非権限者は自分のレコードのみにフォールバックする（emp5 の2件）。
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.total).toBe(2)
      expect(parsed.data.data.every((record) => record.employee_id === 5)).toBe(true)
    }
  })

  test("member requesting another employee_id is forbidden", async () => {
    const response = await getRequest("/attendance?employee_id=9", await tokenFor(5, "member"))

    expect(response.status).toBe(403)
  })

  test("returns 400 when from is not a valid date format", async () => {
    const response = await getRequest("/attendance?from=aaa", await tokenFor(1, "admin"))

    expect(response.status).toBe(400)
  })

  test("returns 400 when to is not a valid date format", async () => {
    const response = await getRequest("/attendance?to=2026/06/01", await tokenFor(1, "admin"))

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest("/attendance", null)

    expect(response.status).toBe(401)
  })
})
