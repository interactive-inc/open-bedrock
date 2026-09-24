import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedAttendanceRecords } from "@/contexts/attendance/test/seed/seed-attendance-records.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(5)
})

afterAll(async () => {
  await pool.dispose()
})

const jwtSecret = "attendance-me-route-test-secret"

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
  const db = await pool.next()

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

describe("GET /attendance-records/me", () => {
  test("returns own records and ignores employee_id", async () => {
    const response = await getRequest(
      "/attendance/attendance-records/me?employee_id=9",
      await tokenFor(5),
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

  test("filters own records by from/to", async () => {
    const response = await getRequest(
      "/attendance/attendance-records/me?from=2026-05-26&to=2026-05-26",
      await tokenFor(5),
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
      "/attendance/attendance-records/me?from=aaa",
      await tokenFor(5),
    )

    expect(response.status).toBe(400)
  })

  test("returns 400 when to is not a valid date format", async () => {
    const response = await getRequest(
      "/attendance/attendance-records/me?to=2026/06/01",
      await tokenFor(5),
    )

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest("/attendance/attendance-records/me", null)

    expect(response.status).toBe(401)
  })
})
