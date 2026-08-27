import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
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

const jwtSecret = "minutes-route-test-secret"

const minutesResponseSchema = z.object({
  id: z.number(),
  meeting_id: z.number(),
  held_on: z.string(),
  title: z.string(),
  attendees: z.string().nullable(),
  body_md: z.string(),
  author_employee_id: zEmployeeId,
  created_at: z.string(),
})

const minutesListResponseSchema = z.object({
  data: z.array(minutesResponseSchema),
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

  // author は E002(member)。
  await seedD1(db, "meeting_minutes_records", [
    {
      id: 1,
      meeting_id: 1,
      held_on: "2026-02-01",
      title: "2月度取締役会",
      attendees: "E001,E002",
      body_md: "## 議題\n\n予算の確認。",
      author_employee_id: "2",
      created_at: "2026-02-01T00:00:00Z",
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

function authorToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(2),
  })
}

function otherMemberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(3),
  })
}

describe("GET /meetings/:code/minutes", () => {
  test("returns 200 with the minutes list", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings/board/minutes",
      token: await otherMemberToken(),
    })

    expect(response.status).toBe(200)

    const parsed = minutesListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0]?.title).toBe("2月度取締役会")
    }
  })

  test("returns 404 for an unknown meeting", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings/nope/minutes",
      token: await otherMemberToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("POST /meetings/:code/minutes", () => {
  test("any authenticated user can record minutes", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meetings/board/minutes",
      token: await otherMemberToken(),
      method: "POST",
      body: { held_on: "2026-03-01", title: "3月度", attendees: null, body_md: "本文" },
    })

    expect(response.status).toBe(201)

    const parsed = minutesResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.author_employee_id).toBe(toWorkforceEmployeeId(3))
      expect(parsed.data.meeting_id).toBe(1)
    }
  })
})

describe("GET /meeting-minutes-records/:id", () => {
  test("returns 200 with the minutes detail", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meeting-minutes-records/1",
      token: await otherMemberToken(),
    })

    expect(response.status).toBe(200)

    const parsed = minutesResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)
  })

  test("returns 404 when the minutes does not exist", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meeting-minutes-records/9999",
      token: await otherMemberToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /meeting-minutes-records/:id", () => {
  test("author can update", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meeting-minutes-records/1",
      token: await authorToken(),
      method: "PUT",
      body: { held_on: "2026-02-01", title: "改訂", attendees: null, body_md: "改訂本文" },
    })

    expect(response.status).toBe(200)

    const parsed = minutesResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("改訂")
    }
  })

  test("meeting:manage holder (non-author) can update", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meeting-minutes-records/1",
      token: await adminToken(),
      method: "PUT",
      body: { held_on: "2026-02-01", title: "管理者改訂", attendees: null, body_md: "本文" },
    })

    expect(response.status).toBe(200)
  })

  test("a non-author without meeting:manage gets 403", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/meeting-minutes-records/1",
      token: await otherMemberToken(),
      method: "PUT",
      body: { held_on: "2026-02-01", title: "x", attendees: null, body_md: "本文" },
    })

    expect(response.status).toBe(403)
  })
})
