import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "iam-accounts-route-test-secret"

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

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: 1, email: "you+e001@example.com", role: "admin" })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

async function request(props: { token: string | null }): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: "/accounts",
    token: props.token,
  })
}

describe("GET /accounts", () => {
  test("returns accounts with employee name and roles for an admin", async () => {
    const response = await request({ token: await adminToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({
        data: z.array(
          z.object({
            id: z.number(),
            employee_id: z.number().nullable(),
            employee_name: z.string().nullable(),
            status: z.string(),
            role_keys: z.array(z.string()),
            can_manage: z.boolean(),
            is_self: z.boolean(),
          }),
        ),
        total: z.number(),
      })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBeGreaterThan(0)

      const adminAccount = parsed.data.data.find((account) => account.role_keys.includes("admin"))

      expect(adminAccount).toBeDefined()
      expect(adminAccount?.can_manage).toBe(true)
      expect(adminAccount?.is_self).toBe(true)
    }
  })

  test("returns 403 for a member without account:manage", async () => {
    const response = await request({ token: await memberToken() })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ token: null })

    expect(response.status).toBe(401)
  })
})
