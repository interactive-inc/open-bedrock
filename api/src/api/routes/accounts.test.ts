import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
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
  return createTestToken(jwtSecret, { employeeId: 1, email: "you+e001@example.com", role: "root" })
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
  test("returns accounts with the Company profile display name and roles for an admin", async () => {
    const db = await createTestDb()
    await db
      .prepare(
        `UPDATE company_account_profiles
         SET display_name = 'Company Profile Name'
         WHERE account_id = '1'`,
      )
      .run()
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/accounts",
      token: await adminToken(),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({
        data: z.array(
          z.object({
            id: z.string(),
            employee_id: z.number().nullable(),
            employee_name: z.string(),
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

      const adminAccount = parsed.data.data.find((account) => account.role_keys.includes("root"))

      expect(adminAccount).toBeDefined()
      expect(adminAccount?.employee_name).toBe("Company Profile Name")
      expect(adminAccount?.can_manage).toBe(true)
      expect(adminAccount?.is_self).toBe(true)
    }
  })

  test("returns 403 for a member without account:manage", async () => {
    const response = await request({ token: await memberToken() })

    expect(response.status).toBe(403)
  })

  test("fails closed when a Company-visible Account profile is missing", async () => {
    const db = await createTestDb()
    await db.prepare("DELETE FROM company_account_profiles WHERE account_id = '2'").run()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/accounts",
      token: await adminToken(),
    })

    expect(response.status).toBe(500)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ token: null })

    expect(response.status).toBe(401)
  })
})
