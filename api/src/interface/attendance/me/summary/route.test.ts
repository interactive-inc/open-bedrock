import { describe, expect, test } from "bun:test"
import { seedAttendanceRecords } from "@/infrastructure/seed/seed-attendance-records"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const jwtSecret = "attendance-me-summary-route-test-secret"

const attendanceSummaryResponseSchema = z.object({
  employee_id: z.number(),
  month: z.string(),
  work_days: z.number(),
  total_work_minutes: z.number(),
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

describe("GET /attendance/me/summary", () => {
  test("aggregates closed records for the requested month", async () => {
    const response = await getRequest(
      "/attendance/me/summary?month=2026-05",
      await tokenFor(5, "member"),
    )

    expect(response.status).toBe(200)

    const parsed = attendanceSummaryResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(5)
      expect(parsed.data.month).toBe("2026-05")
      expect(parsed.data.work_days).toBe(2)
      expect(parsed.data.total_work_minutes).toBe(1050)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest("/attendance/me/summary?month=2026-05", null)

    expect(response.status).toBe(401)
  })
})
