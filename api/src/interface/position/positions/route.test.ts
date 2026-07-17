import { describe, expect, test } from "bun:test"
import { seedPositions } from "@/infrastructure/seed/seed-positions"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
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
    "positions",
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

describe("GET /positions", () => {
  test("returns 200 with the master ordered by rank for any authenticated user", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/positions",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(positionResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(12)
      expect(parsed.data.data.map((position) => position.rank)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ])
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/positions",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /positions", () => {
  test("position:manage can create a position", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/positions",
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: { code: "VP_ENG", name: "VP of Engineering", rank: 13 },
    })

    expect(response.status).toBe(201)

    const parsed = positionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("VP_ENG")
      expect(parsed.data.rank).toBe(13)
    }
  })

  test("member without position:manage is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/positions",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { code: "VP_ENG", name: "VP of Engineering", rank: 13 },
    })

    expect(response.status).toBe(403)
  })

  test("duplicate code is a conflict", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/positions",
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: { code: "CTO", name: "Duplicate", rank: 99 },
    })

    expect(response.status).toBe(409)
  })
})

describe("PUT /positions/:id", () => {
  test("position:manage can update a position", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/positions/1",
      token: await tokenFor(1, "admin"),
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
      path: "/positions/1",
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
      path: "/positions/999",
      token: await tokenFor(1, "admin"),
      method: "PUT",
      body: { code: "XX", name: "Ghost", rank: 99 },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /positions/:id", () => {
  test("position:manage can delete a position", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/positions/12",
      token: await tokenFor(1, "admin"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("member is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/positions/12",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })
})
