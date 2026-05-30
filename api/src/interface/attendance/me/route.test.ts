import { describe, expect, test } from "bun:test"
import { seedAttendanceRecords } from "@/infrastructure/seed/seed-attendance-records"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const jwtSecret = "attendance-me-route-test-secret"

const attendanceRecordResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  work_date: z.string(),
  clock_in_at: z.string().nullable(),
  clock_out_at: z.string().nullable(),
  work_minutes: z.number().nullable(),
  overtime_minutes: z.number().nullable(),
  status: z.string(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

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
      overtime_minutes: record.overtimeMinutes,
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

describe("GET /attendance/me", () => {
  test("returns own records and ignores employee_id", async () => {
    const response = await getRequest("/attendance/me?employee_id=9", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = z.array(attendanceRecordResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(2)
      expect(parsed.data.every((record) => record.employee_id === 5)).toBe(true)
    }
  })

  test("filters own records by from/to", async () => {
    const response = await getRequest(
      "/attendance/me?from=2026-05-26&to=2026-05-26",
      await tokenFor(5, "member"),
    )

    expect(response.status).toBe(200)

    const parsed = z.array(attendanceRecordResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
      expect(parsed.data[0]?.id).toBe(2)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest("/attendance/me", null)

    expect(response.status).toBe(401)
  })
})
