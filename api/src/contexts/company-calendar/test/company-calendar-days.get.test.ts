import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/api/test/support/company/seed-employees.test-support"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@/api/test/support/initialize-standard-company-test-state"

const jwtSecret = "calendar-route-test-secret"

const calendarDayResponseSchema = z.object({
  id: z.number(),
  calendar_date: z.string(),
  kind: z.enum(["holiday", "workday"]),
  name: z.string().nullable(),
  created_at: z.string(),
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

  await seedD1(db, "company_calendar_days", [
    {
      id: 1,
      calendar_date: "2026-01-01",
      kind: "holiday",
      name: "元日",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 2,
      calendar_date: "2026-05-02",
      kind: "workday",
      name: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 3,
      calendar_date: "2025-12-31",
      kind: "holiday",
      name: "大晦日",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ])
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
  })
}

describe("GET /company-calendar-days", () => {
  test("returns the days within the requested year for any authenticated user", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company-calendar-days?year=2026",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(calendarDayResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)
      expect(parsed.data.data.map((day) => day.calendar_date)).toEqual(["2026-01-01", "2026-05-02"])
    }
  })

  test("returns 400 for an invalid year", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company-calendar-days?year=20xx",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company-calendar-days?year=2026",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /company-calendar-days", () => {
  test("calendar:manage can record a holiday", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company-calendar-days",
      token: await tokenFor(1),
      method: "POST",
      body: { calendar_date: "2026-05-05", kind: "holiday", name: "こどもの日" },
    })

    expect(response.status).toBe(201)

    const parsed = calendarDayResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.calendar_date).toBe("2026-05-05")
      expect(parsed.data.kind).toBe("holiday")
    }
  })

  test("member without calendar:manage is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company-calendar-days",
      token: await tokenFor(5),
      method: "POST",
      body: { calendar_date: "2026-05-05", kind: "holiday", name: null },
    })

    expect(response.status).toBe(403)
  })

  test("duplicate calendar_date is a conflict", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company-calendar-days",
      token: await tokenFor(1),
      method: "POST",
      body: { calendar_date: "2026-01-01", kind: "holiday", name: "重複" },
    })

    expect(response.status).toBe(409)
  })

  test("invalid kind is rejected", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company-calendar-days",
      token: await tokenFor(1),
      method: "POST",
      body: { calendar_date: "2026-05-05", kind: "weekend", name: null },
    })

    expect(response.status).toBe(400)
  })
})

describe("DELETE /company-calendar-days/:id", () => {
  test("calendar:manage can delete a day", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company-calendar-days/1",
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("member is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company-calendar-days/1",
      token: await tokenFor(5),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("unknown day is 404", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company-calendar-days/999",
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })
})
