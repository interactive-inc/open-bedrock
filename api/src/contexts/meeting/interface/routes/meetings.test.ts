import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "meetings-route-test-secret"

const meetingResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  cadence: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(["active", "archived"]),
  created_at: z.string(),
})

const meetingListResponseSchema = z.object({
  data: z.array(meetingResponseSchema),
  total: z.number(),
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

  await seedD1(db, "meetings", [
    {
      id: 1,
      code: "board",
      name: "取締役会",
      cadence: "月次",
      description: null,
      status: "active",
      created_at: "2026-01-05T00:00:00Z",
    },
  ])
  await initializeStandardCompanyTestState(db)

  return db
}

/** E001 は admin(meeting:manage あり)。E002 は member(権限なし)。 */
function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(1),
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(2),
  })
}

describe("GET /meetings", () => {
  test("returns 200 with the meeting list", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings",
      token: await memberToken(),
    })

    expect(response.status).toBe(200)

    const parsed = meetingListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0]?.code).toBe("board")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /meetings", () => {
  test("admin creates a meeting", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings",
      token: await adminToken(),
      method: "POST",
      body: { code: "leadership", name: "経営会議", cadence: "週次" },
    })

    expect(response.status).toBe(201)

    const parsed = meetingResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("leadership")
      expect(parsed.data.status).toBe("active")
    }
  })

  test("member without meeting:manage gets 403", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings",
      token: await memberToken(),
      method: "POST",
      body: { code: "leadership", name: "経営会議", cadence: null },
    })

    expect(response.status).toBe(403)
  })

  test("duplicate code gets 409", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings",
      token: await adminToken(),
      method: "POST",
      body: { code: "board", name: "重複", cadence: null },
    })

    expect(response.status).toBe(409)
  })
})
