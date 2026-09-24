import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
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
  pool = await startLocalD1Pool(6)
})

afterAll(async () => {
  await pool.dispose()
})

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
  await initializeStandardCompanyTestState(db)

  return db
}

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

describe("GET /meetings/:code", () => {
  test("returns 200 with the meeting detail", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meeting/meetings/board",
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
      path: "/meeting/meetings/nope",
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
      path: "/meeting/meetings/board",
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
      path: "/meeting/meetings/board",
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
      path: "/meeting/meetings/board/archive",
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
      path: "/meeting/meetings/board/archive",
      token: await memberToken(),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })
})
