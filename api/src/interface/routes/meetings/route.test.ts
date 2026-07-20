import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

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

  return db
}

/** E001 は admin(meeting:manage あり)。E002 は member(権限なし)。 */
function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 2,
    email: "you+e002@example.com",
    role: "member",
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
