import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { initializeCompanyTestFixture } from "@/api/test/support/initialize-company-test-fixture"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@/api/test/support/initialize-standard-company-test-state"

const jwtSecret = "overtime-summary-route-test-secret"

const overtimeSummarySchema = z.object({
  month: z.string(),
  business_days: z.number(),
  daily_regular_minutes: z.number(),
  entries: z.array(
    z.object({
      employee_id: z.number(),
      work_days: z.number(),
      total_work_minutes: z.number(),
      overtime_minutes: z.number(),
    }),
  ),
  note: z.string(),
})

/** scope=reports 用に、manager(id2)が id20/id21 の 2 名を配下に持つ小さな組織を組む。 */
const scopeEmployeeRows = [
  { id: 2, code: "M002", email: "you+m002@example.com", role: "manager" },
  { id: 20, code: "R020", email: "you+r020@example.com", role: "member" },
  { id: 21, code: "R021", email: "you+r021@example.com", role: "member" },
]

async function createScopeTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.code,
      dept_id: 1,
      dept_name: "Dept",
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

  await seedD1(db, "org_memberships", [
    { department_code: "D001", employee_code: "M002", manager_employee_code: null },
    { department_code: "D001", employee_code: "R020", manager_employee_code: "M002" },
    { department_code: "D001", employee_code: "R021", manager_employee_code: "M002" },
  ])

  // 2026-06 は平日 22 日 = 所定 10560 分。R020 は 12 日で 6000 分（時間外 0）。
  // R021 は毎日 600 分×22 日 = 13200 分（時間外 2640 分）。
  const records: Array<Record<string, string | number | boolean | null>> = []

  let id = 100

  for (let day = 1; day <= 12; day++) {
    records.push({
      id: id++,
      employee_id: 20,
      work_date: `2026-06-${String(day).padStart(2, "0")}`,
      clock_in_at: null,
      clock_out_at: null,
      work_minutes: 500,
      status: "closed",
    })
  }

  for (let day = 1; day <= 22; day++) {
    records.push({
      id: id++,
      employee_id: 21,
      work_date: `2026-06-${String(day).padStart(2, "0")}`,
      clock_in_at: null,
      clock_out_at: null,
      work_minutes: 600,
      status: "closed",
    })
  }

  await seedD1(db, "attendance_records", records)

  await initializeCompanyTestFixture({
    db,
    departments: [{ id: 1, code: "D001", name: "Dept", managerEmployeeCode: "M002" }],
  })

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
  })
}

describe("GET /attendance-records/overtime-summary", () => {
  test("scope=reports aggregates overtime for reports as a reference value", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/attendance-records/overtime-summary?month=2026-06&scope=reports",
      token: await tokenFor(2),
      now: "2026-06-15T00:00:00.000Z",
    })

    expect(response.status).toBe(200)

    const parsed = overtimeSummarySchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.business_days).toBe(22)
      expect(parsed.data.daily_regular_minutes).toBe(480)
      expect(parsed.data.note.length).toBeGreaterThan(0)

      const byId = new Map(parsed.data.entries.map((entry) => [entry.employee_id, entry]))

      expect(byId.get(20)?.overtime_minutes).toBe(0)
      expect(byId.get(21)?.total_work_minutes).toBe(13200)
      expect(byId.get(21)?.overtime_minutes).toBe(2640)
    }
  })

  test("member requesting scope=reports is forbidden", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/attendance-records/overtime-summary?scope=reports",
      token: await tokenFor(20),
      now: "2026-06-15T00:00:00.000Z",
    })

    expect(response.status).toBe(403)
  })

  test("member requesting scope=all is forbidden", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/attendance-records/overtime-summary?scope=all",
      token: await tokenFor(20),
      now: "2026-06-15T00:00:00.000Z",
    })

    expect(response.status).toBe(403)
  })

  test("scope unspecified aggregates only the caller", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/attendance-records/overtime-summary?month=2026-06",
      token: await tokenFor(21),
      now: "2026-06-15T00:00:00.000Z",
    })

    expect(response.status).toBe(200)

    const parsed = overtimeSummarySchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.entries.length).toBe(1)
      expect(parsed.data.entries[0]?.employee_id).toBe(21)
      expect(parsed.data.entries[0]?.overtime_minutes).toBe(2640)
    }
  })

  test("invalid month returns 400", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/attendance-records/overtime-summary?month=2026-6",
      token: await tokenFor(21),
      now: "2026-06-15T00:00:00.000Z",
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/attendance-records/overtime-summary?month=2026-06",
      token: null,
      now: "2026-06-15T00:00:00.000Z",
    })

    expect(response.status).toBe(401)
  })
})
