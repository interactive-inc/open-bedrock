import { describe, expect, test } from "bun:test"
import { seedAttendanceRecords } from "@/contexts/company/infrastructure/seed/seed-attendance-records"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "attendance-me-route-test-secret"

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

const attendanceListResponseSchema = z.object({
  data: z.array(attendanceRecordResponseSchema),
  total: z.number(),
})

describe("GET /attendance-records/me", () => {
  test("returns own records and ignores employee_id", async () => {
    const response = await getRequest(
      "/attendance-records/me?employee_id=9",
      await tokenFor(5, "member"),
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

  test("filters own records by from/to", async () => {
    const response = await getRequest(
      "/attendance-records/me?from=2026-05-26&to=2026-05-26",
      await tokenFor(5, "member"),
    )

    expect(response.status).toBe(200)

    const parsed = attendanceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0]?.id).toBe(2)
    }
  })

  test("returns 400 when from is not a valid date format", async () => {
    const response = await getRequest(
      "/attendance-records/me?from=aaa",
      await tokenFor(5, "member"),
    )

    expect(response.status).toBe(400)
  })

  test("returns 400 when to is not a valid date format", async () => {
    const response = await getRequest(
      "/attendance-records/me?to=2026/06/01",
      await tokenFor(5, "member"),
    )

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest("/attendance-records/me", null)

    expect(response.status).toBe(401)
  })
})
