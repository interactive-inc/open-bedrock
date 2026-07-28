import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "minutes-route-test-secret"

const minutesResponseSchema = z.object({
  id: z.number(),
  meeting_id: z.number(),
  held_on: z.string(),
  title: z.string(),
  attendees: z.string().nullable(),
  body_md: z.string(),
  author_employee_id: z.number(),
  created_at: z.string(),
})

const minutesListResponseSchema = z.object({
  data: z.array(minutesResponseSchema),
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

  // author は E002(member)。
  await seedD1(db, "meeting_minutes", [
    {
      id: 1,
      meeting_id: 1,
      held_on: "2026-02-01",
      title: "2月度取締役会",
      attendees: "E001,E002",
      body_md: "## 議題\n\n予算の確認。",
      author_employee_id: 2,
      created_at: "2026-02-01T00:00:00Z",
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

function authorToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 2,
    email: "you+e002@example.com",
    role: "member",
  })
}

function otherMemberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 3,
    email: "you+e003@example.com",
    role: "member",
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
      expect(parsed.data.author_employee_id).toBe(3)
      expect(parsed.data.meeting_id).toBe(1)
    }
  })
})

describe("GET /minutes/:id", () => {
  test("returns 200 with the minutes detail", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/minutes/1",
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
      path: "/minutes/9999",
      token: await otherMemberToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /minutes/:id", () => {
  test("author can update", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/minutes/1",
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
      path: "/minutes/1",
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
      path: "/minutes/1",
      token: await otherMemberToken(),
      method: "PUT",
      body: { held_on: "2026-02-01", title: "x", attendees: null, body_md: "本文" },
    })

    expect(response.status).toBe(403)
  })
})
