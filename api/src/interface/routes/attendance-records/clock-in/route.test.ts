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

const jwtSecret = "attendance-clock-in-route-test-secret"

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

describe("POST /attendance-records/clock-in", () => {
  test("opens a record for the authenticated user and returns 201", async () => {
    const response = await send({
      db: await createTestDb(),
      method: "POST",
      path: "/attendance-records/clock-in",
      token: await tokenFor(10, "member"),
      now: "2026-05-29T09:00:00Z",
      body: { note: "morning" },
    })

    expect(response.status).toBe(201)

    const parsed = attendanceRecordResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(10)
      expect(parsed.data.work_date).toBe("2026-05-29")
      expect(parsed.data.clock_in_at).toBe("2026-05-29T09:00:00Z")
      expect(parsed.data.status).toBe("open")
      expect(parsed.data.clock_out_at).toBeNull()
    }
  })

  test("returns 409 when already clocked in", async () => {
    const response = await send({
      db: await createTestDb(),
      method: "POST",
      path: "/attendance-records/clock-in",
      token: await tokenFor(9, "member"),
      now: "2026-05-29T09:00:00Z",
      body: {},
    })

    expect(response.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await send({
      db: await createTestDb(),
      method: "POST",
      path: "/attendance-records/clock-in",
      token: null,
      now: "2026-05-29T09:00:00Z",
      body: {},
    })

    expect(response.status).toBe(401)
  })
})
