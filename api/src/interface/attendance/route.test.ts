import { describe, expect, test } from "bun:test"
import { seedAttendanceRecords } from "@/infrastructure/seed/seed-attendance-records"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
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
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
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

describe("GET /attendance", () => {
  test("privileged role can read another employee via employee_id", async () => {
    const response = await getRequest("/attendance?employee_id=5", await tokenFor(1, "admin"))

    expect(response.status).toBe(200)

    const parsed = z.array(attendanceRecordResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(2)
      expect(parsed.data.every((record) => record.employee_id === 5)).toBe(true)
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
