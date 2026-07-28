import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "meeting-detail-route-test-secret"

const meetingResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  cadence: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(["active", "archived"]),
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

  await seedD1(db, "meetings", [
    {
      id: 1,
      code: "board",
      name: "取締役会",
      cadence: "月次",
      description: "月次の取締役会",
      status: "active",
      created_at: "2026-01-05T00:00:00Z",
    },
  ])

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "root",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 2,
    email: "you+e002@example.com",
    role: "member",
  })
}

describe("GET /meetings/:code", () => {
  test("returns 200 with the meeting detail", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings/board",
      token: await memberToken(),
    })

    expect(response.status).toBe(200)

    const parsed = meetingResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("取締役会")
    }
  })

  test("returns 404 when the meeting does not exist", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings/nope",
      token: await memberToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /meetings/:code", () => {
  test("admin updates the meeting", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings/board",
      token: await adminToken(),
      method: "PUT",
      body: { name: "取締役会（改称）", cadence: "四半期", description: null },
    })

    expect(response.status).toBe(200)

    const parsed = meetingResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("取締役会（改称）")
      expect(parsed.data.cadence).toBe("四半期")
    }
  })

  test("member without meeting:manage gets 403", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings/board",
      token: await memberToken(),
      method: "PUT",
      body: { name: "x", cadence: null, description: null },
    })

    expect(response.status).toBe(403)
  })
})

describe("POST /meetings/:code/archive", () => {
  test("admin archives the meeting", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings/board/archive",
      token: await adminToken(),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const parsed = meetingResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("archived")
    }
  })

  test("member without meeting:manage gets 403", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings/board/archive",
      token: await memberToken(),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })
})
