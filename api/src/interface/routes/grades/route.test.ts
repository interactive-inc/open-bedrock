import { describe, expect, test } from "bun:test"
import { seedGrades } from "@/infrastructure/seed/seed-grades"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const gradeResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  rank: z.number(),
  description: z.string().nullable(),
  created_at: z.string(),
})

const jwtSecret = "grade-master-route-test-secret"

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
    "grade_definitions",
    seedGrades.map((grade) => ({
      id: grade.id,
      code: grade.code,
      name: grade.name,
      rank: grade.rank,
      description: grade.description,
      created_at: grade.createdAt,
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

describe("GET /grades", () => {
  test("returns 200 with the master ordered by rank for any authenticated user", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/grades",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(gradeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(3)
      expect(parsed.data.data.map((grade) => grade.rank)).toEqual([1, 2, 3])
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/grades",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /grades", () => {
  test("grade:manage can create a grade", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/grades",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { code: "G4", name: "Lead", rank: 4 },
    })

    expect(response.status).toBe(201)

    const parsed = gradeResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("G4")
      expect(parsed.data.rank).toBe(4)
    }
  })

  test("member without grade:manage is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/grades",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { code: "G4", name: "Lead", rank: 4 },
    })

    expect(response.status).toBe(403)
  })

  test("duplicate code is a conflict", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/grades",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { code: "G1", name: "Duplicate", rank: 9 },
    })

    expect(response.status).toBe(409)
  })
})

describe("PUT /grades/:id", () => {
  test("grade:manage can update a grade", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/grades/1",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { code: "G1", name: "Associate II", rank: 1, description: "updated" },
    })

    expect(response.status).toBe(200)

    const parsed = gradeResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("Associate II")
      expect(parsed.data.description).toBe("updated")
    }
  })

  test("member is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/grades/1",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { code: "G1", name: "Associate II", rank: 1 },
    })

    expect(response.status).toBe(403)
  })

  test("unknown grade is 404", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/grades/999",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { code: "GX", name: "Ghost", rank: 9 },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /grades/:id", () => {
  test("grade:manage can delete a grade", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/grades/3",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("member is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/grades/3",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })
})
