import { describe, expect, test } from "bun:test"
import { seedPositions } from "@/infrastructure/seed/seed-positions"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const positionResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  rank: z.number(),
  description: z.string().nullable(),
  created_at: z.string(),
})

const jwtSecret = "position-master-route-test-secret"

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
    "position_definitions",
    seedPositions.map((position) => ({
      id: position.id,
      code: position.code,
      name: position.name,
      rank: position.rank,
      description: position.description,
      created_at: position.createdAt,
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

describe("GET /position-definitions", () => {
  test("returns 200 with the master ordered by rank for any authenticated user", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/position-definitions",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(positionResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedPositions.length)
      expect(parsed.data.data.map((position) => position.rank)).toEqual(
        seedPositions.map((position) => position.rank),
      )
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/position-definitions",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /position-definitions", () => {
  test("position:manage can create a position", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/position-definitions",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { code: "LEAD", name: "Lead", rank: 20 },
    })

    expect(response.status).toBe(201)

    const parsed = positionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("LEAD")
      expect(parsed.data.rank).toBe(20)
    }
  })

  test("member without position:manage is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/position-definitions",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { code: "LEAD", name: "Lead", rank: 20 },
    })

    expect(response.status).toBe(403)
  })

  test("duplicate code is a conflict", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/position-definitions",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { code: "CTO", name: "Duplicate", rank: 99 },
    })

    expect(response.status).toBe(409)
  })
})

describe("PUT /position-definitions/:id", () => {
  test("position:manage can update a position", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/position-definitions/1",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { code: "CTO", name: "Chief Technology Officer", rank: 1, description: "updated" },
    })

    expect(response.status).toBe(200)

    const parsed = positionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("Chief Technology Officer")
      expect(parsed.data.description).toBe("updated")
    }
  })

  test("member is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/position-definitions/1",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { code: "CTO", name: "Chief Technology Officer", rank: 1 },
    })

    expect(response.status).toBe(403)
  })

  test("unknown position is 404", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/position-definitions/999",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { code: "GHOST", name: "Ghost", rank: 99 },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /position-definitions/:id", () => {
  test("position:manage can delete a position no employee uses", async () => {
    const db = await createTestDb()

    const created = await requestWithContext({
      db,
      jwtSecret,
      path: "/position-definitions",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { code: "UNUSED", name: "Unused Role", rank: 30 },
    })

    const createdId = ((await created.json()) as { id: number }).id

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/position-definitions/${createdId}`,
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("member is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/position-definitions/1",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("a position in use by employees is a conflict", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/position-definitions/1",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })
})
