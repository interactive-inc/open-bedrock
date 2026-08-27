import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedAttendanceRecords } from "@/contexts/attendance/test/seed/seed-attendance-records.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "attendance-clock-out-route-test-secret"

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

type SendProps = {
  db: D1Database
  method: string
  path: string
  token: string | null
  now: string
  body?: unknown
}

/** now を任意の時刻に固定して app を叩く。同じ db を渡せば状態が引き継がれる。 */
function send(props: SendProps): Promise<Response> {
  return requestWithContext({
    db: props.db,
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
    now: props.now,
  })
}

describe("POST /attendance-records/clock-out", () => {
  test("clock-in then clock-out computes work minutes", async () => {
    const db = await createTestDb()

    const token = await tokenFor(10)

    const inResponse = await send({
      db,
      method: "POST",
      path: "/attendance-records/clock-in",
      token,
      now: "2026-05-29T09:00:00Z",
      body: {},
    })

    expect(inResponse.status).toBe(201)

    const outResponse = await send({
      db,
      method: "POST",
      path: "/attendance-records/clock-out",
      token,
      now: "2026-05-29T18:30:00Z",
      body: {},
    })

    expect(outResponse.status).toBe(200)

    const parsed = attendanceRecordResponseSchema.safeParse(await outResponse.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("closed")
      expect(parsed.data.work_minutes).toBe(570)
      expect(parsed.data.clock_out_at).toBe("2026-05-29T18:30:00Z")
    }
  })

  test("returns 409 when not clocked in", async () => {
    const response = await send({
      db: await createTestDb(),
      method: "POST",
      path: "/attendance-records/clock-out",
      token: await tokenFor(5),
      now: "2026-05-29T18:30:00Z",
      body: {},
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when there is no prior clock-in", async () => {
    const db = await createTestDb()

    // Insert an open record whose clock_in_at is null (anomalous state).
    await db
      .prepare(
        "INSERT INTO attendance_records (id, employee_id, work_date, clock_in_at, clock_out_at, work_minutes, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(999, 10, "2026-05-30", null, null, null, "open")
      .run()

    const response = await send({
      db,
      method: "POST",
      path: "/attendance-records/clock-out",
      token: await tokenFor(10),
      now: "2026-05-30T18:00:00Z",
      body: {},
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when already clocked out (concurrent request)", async () => {
    const db = await createTestDb()

    const token = await tokenFor(10)

    // Clock in
    await send({
      db,
      method: "POST",
      path: "/attendance-records/clock-in",
      token,
      now: "2026-05-29T09:00:00Z",
      body: {},
    })

    // First clock-out succeeds
    const first = await send({
      db,
      method: "POST",
      path: "/attendance-records/clock-out",
      token,
      now: "2026-05-29T18:00:00Z",
      body: {},
    })

    expect(first.status).toBe(200)

    // Second clock-out should fail with 409
    const second = await send({
      db,
      method: "POST",
      path: "/attendance-records/clock-out",
      token,
      now: "2026-05-29T18:30:00Z",
      body: {},
    })

    expect(second.status).toBe(409)
  })

  test("persists note when provided", async () => {
    const db = await createTestDb()

    const token = await tokenFor(10)

    await send({
      db,
      method: "POST",
      path: "/attendance-records/clock-in",
      token,
      now: "2026-05-29T09:00:00Z",
      body: {},
    })

    const outResponse = await send({
      db,
      method: "POST",
      path: "/attendance-records/clock-out",
      token,
      now: "2026-05-29T18:30:00Z",
      body: { note: "leaving early" },
    })

    expect(outResponse.status).toBe(200)

    const row = await db
      .prepare("SELECT note FROM attendance_records WHERE employee_id = 10 AND status = 'closed'")
      .first<{ note: string | null }>()

    expect(row?.note).toBe("leaving early")
  })

  test("preserves clock-in note when clock-out omits note", async () => {
    const db = await createTestDb()

    const token = await tokenFor(10)

    await send({
      db,
      method: "POST",
      path: "/attendance-records/clock-in",
      token,
      now: "2026-05-29T09:00:00Z",
      body: { note: "morning" },
    })

    const outResponse = await send({
      db,
      method: "POST",
      path: "/attendance-records/clock-out",
      token,
      now: "2026-05-29T18:30:00Z",
      body: {},
    })

    expect(outResponse.status).toBe(200)

    const row = await db
      .prepare("SELECT note FROM attendance_records WHERE employee_id = 10 AND status = 'closed'")
      .first<{ note: string | null }>()

    expect(row?.note).toBe("morning")
  })

  test("returns 401 without a bearer token", async () => {
    const response = await send({
      db: await createTestDb(),
      method: "POST",
      path: "/attendance-records/clock-out",
      token: null,
      now: "2026-05-29T18:30:00Z",
      body: {},
    })

    expect(response.status).toBe(401)
  })
})
