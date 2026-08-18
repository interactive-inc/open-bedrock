import { describe, expect, test } from "bun:test"
import { seedDepartments } from "@/contexts/company-compatibility/infrastructure/seed/seed-departments"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const departmentDefinitionResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
})

const jwtSecret = "department-master-route-test-secret"

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
    "departments",
    seedDepartments.map((department) => ({
      id: department.id,
      name: department.name,
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

describe("GET /department-definitions", () => {
  test("returns 200 with the master ordered by id for any authenticated user", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/department-definitions",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(departmentDefinitionResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedDepartments.length)

      expect(parsed.data.data.map((department) => department.id)).toEqual(
        seedDepartments.map((department) => department.id),
      )
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/department-definitions",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /department-definitions", () => {
  test("org:manage can create a department", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/department-definitions",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { name: "研究開発部" },
    })

    expect(response.status).toBe(201)

    const parsed = departmentDefinitionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("研究開発部")
      expect(parsed.data.id).toBeGreaterThan(0)
    }
  })

  test("created department appears in the list", async () => {
    const db = await createTestDb()

    const createResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/department-definitions",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { name: "研究開発部" },
    })

    expect(createResponse.status).toBe(201)

    const listResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/department-definitions",
      token: await tokenFor(5, "member"),
    })

    expect(listResponse.status).toBe(200)

    const parsed = z
      .object({ data: z.array(departmentDefinitionResponseSchema), total: z.number() })
      .safeParse(await listResponse.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedDepartments.length + 1)

      expect(parsed.data.data.map((department) => department.name)).toContain("研究開発部")
    }
  })

  test("member without org:manage is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/department-definitions",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { name: "研究開発部" },
    })

    expect(response.status).toBe(403)
  })

  test("duplicate name is a conflict", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/department-definitions",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { name: seedDepartments[0]?.name },
    })

    expect(response.status).toBe(409)
  })

  test("empty name is a bad request", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/department-definitions",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { name: "  " },
    })

    expect(response.status).toBe(400)
  })
})
