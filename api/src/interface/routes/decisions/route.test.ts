import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "decisions-route-test-secret"

const decisionResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  decided_on: z.string(),
  context: z.string(),
  decision: z.string(),
  consequences: z.string().nullable(),
  status: z.enum(["active", "superseded"]),
  superseded_by_id: z.number().nullable(),
  created_at: z.string(),
})

const decisionListResponseSchema = z.object({
  data: z.array(decisionResponseSchema),
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

  await seedD1(db, "decisions", [
    {
      id: 1,
      title: "本社移転",
      decided_on: "2026-01-10",
      context: "手狭になったため。",
      decision: "移転する。",
      consequences: "移転コストが発生。",
      status: "active",
      superseded_by_id: null,
      created_at: "2026-01-10T00:00:00Z",
    },
    {
      id: 2,
      title: "移転先変更",
      decided_on: "2026-02-10",
      context: "候補が増えたため。",
      decision: "別ビルにする。",
      consequences: null,
      status: "active",
      superseded_by_id: null,
      created_at: "2026-02-10T00:00:00Z",
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

describe("GET /decisions", () => {
  test("returns 200 with the decision list", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/decisions",
      token: await memberToken(),
    })

    expect(response.status).toBe(200)

    const parsed = decisionListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/decisions",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /decisions", () => {
  test("admin creates a decision", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/decisions",
      token: await adminToken(),
      method: "POST",
      body: {
        title: "新事業開始",
        decided_on: "2026-03-01",
        context: "市場機会があるため。",
        decision: "開始する。",
        consequences: null,
      },
    })

    expect(response.status).toBe(201)

    const parsed = decisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("active")
    }
  })

  test("member without decision:manage gets 403", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/decisions",
      token: await memberToken(),
      method: "POST",
      body: {
        title: "x",
        decided_on: "2026-03-01",
        context: "c",
        decision: "d",
        consequences: null,
      },
    })

    expect(response.status).toBe(403)
  })
})

describe("GET /decisions/:id", () => {
  test("returns 200 with the decision detail", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/decisions/1",
      token: await memberToken(),
    })

    expect(response.status).toBe(200)

    const parsed = decisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("本社移転")
    }
  })

  test("returns 404 when the decision does not exist", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/decisions/9999",
      token: await memberToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /decisions/:id", () => {
  test("admin updates a decision", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/decisions/1",
      token: await adminToken(),
      method: "PUT",
      body: {
        title: "本社移転（修正）",
        decided_on: "2026-01-10",
        context: "手狭。",
        decision: "移転する。",
        consequences: "コスト増。",
      },
    })

    expect(response.status).toBe(200)

    const parsed = decisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("本社移転（修正）")
    }
  })
})

describe("POST /decisions/:id/supersede", () => {
  test("admin supersedes decision 1 with decision 2", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/decisions/1/supersede",
      token: await adminToken(),
      method: "POST",
      body: { superseded_by_id: 2 },
    })

    expect(response.status).toBe(200)

    const parsed = decisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("superseded")
      expect(parsed.data.superseded_by_id).toBe(2)
    }
  })

  test("superseding an already-superseded decision gets 409", async () => {
    const db = await createTestDb()

    const first = await requestWithContext({
      db,
      jwtSecret,
      path: "/decisions/1/supersede",
      token: await adminToken(),
      method: "POST",
      body: { superseded_by_id: 2 },
    })

    expect(first.status).toBe(200)

    const second = await requestWithContext({
      db,
      jwtSecret,
      path: "/decisions/1/supersede",
      token: await adminToken(),
      method: "POST",
      body: { superseded_by_id: 2 },
    })

    expect(second.status).toBe(409)
  })

  test("member without decision:manage gets 403", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/decisions/1/supersede",
      token: await memberToken(),
      method: "POST",
      body: { superseded_by_id: 2 },
    })

    expect(response.status).toBe(403)
  })
})
