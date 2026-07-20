import { describe, expect, test } from "bun:test"
import { seedAttendanceRecords } from "@/infrastructure/seed/seed-attendance-records"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "attendance-clock-out-route-test-secret"

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

describe("POST /attendance/clock-out", () => {
  test("clock-in then clock-out computes work minutes", async () => {
    const db = await createTestDb()

    const token = await tokenFor(10, "member")

    const inResponse = await send({
      db,
      method: "POST",
      path: "/attendance/clock-in",
      token,
      now: "2026-05-29T09:00:00Z",
      body: {},
    })

    expect(inResponse.status).toBe(201)

    const outResponse = await send({
      db,
      method: "POST",
      path: "/attendance/clock-out",
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
      path: "/attendance/clock-out",
      token: await tokenFor(5, "member"),
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
      path: "/attendance/clock-out",
      token: await tokenFor(10, "member"),
      now: "2026-05-30T18:00:00Z",
      body: {},
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when already clocked out (concurrent request)", async () => {
    const db = await createTestDb()

    const token = await tokenFor(10, "member")

    // Clock in
    await send({
      db,
      method: "POST",
      path: "/attendance/clock-in",
      token,
      now: "2026-05-29T09:00:00Z",
      body: {},
    })

    // First clock-out succeeds
    const first = await send({
      db,
      method: "POST",
      path: "/attendance/clock-out",
      token,
      now: "2026-05-29T18:00:00Z",
      body: {},
    })

    expect(first.status).toBe(200)

    // Second clock-out should fail with 409
    const second = await send({
      db,
      method: "POST",
      path: "/attendance/clock-out",
      token,
      now: "2026-05-29T18:30:00Z",
      body: {},
    })

    expect(second.status).toBe(409)
  })

  test("persists note when provided", async () => {
    const db = await createTestDb()

    const token = await tokenFor(10, "member")

    await send({
      db,
      method: "POST",
      path: "/attendance/clock-in",
      token,
      now: "2026-05-29T09:00:00Z",
      body: {},
    })

    const outResponse = await send({
      db,
      method: "POST",
      path: "/attendance/clock-out",
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

    const token = await tokenFor(10, "member")

    await send({
      db,
      method: "POST",
      path: "/attendance/clock-in",
      token,
      now: "2026-05-29T09:00:00Z",
      body: { note: "morning" },
    })

    const outResponse = await send({
      db,
      method: "POST",
      path: "/attendance/clock-out",
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
      path: "/attendance/clock-out",
      token: null,
      now: "2026-05-29T18:30:00Z",
      body: {},
    })

    expect(response.status).toBe(401)
  })
})
