import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees.repository"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { verifyStandardCompanyMigration } from "@/api/test/support/verify-standard-company-migration"
import { z } from "zod"

const jwtSecret = "me-phone-route-test-secret"

const phoneResponseSchema = z.object({
  phone: z.string().nullable(),
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
  await verifyStandardCompanyMigration(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: "member",
  })
}

describe("PUT /me/phone", () => {
  test("updates the caller's own phone number", async () => {
    const db = await createTestDb()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/me/phone",
      token: await tokenFor(1),
      method: "PUT",
      body: { phone: "090-1234-5678" },
    })

    expect(response.status).toBe(200)

    const parsed = phoneResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.phone).toBe("090-1234-5678")
    }

    const meResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/me",
      token: await tokenFor(1),
    })

    const me = z.object({ phone: z.string().nullable() }).parse(await meResponse.json())

    expect(me.phone).toBe("090-1234-5678")
  })

  test("clears the phone number when null is sent", async () => {
    const db = await createTestDb()

    await requestWithContext({
      db,
      jwtSecret,
      path: "/me/phone",
      token: await tokenFor(1),
      method: "PUT",
      body: { phone: "090-1234-5678" },
    })

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/me/phone",
      token: await tokenFor(1),
      method: "PUT",
      body: { phone: null },
    })

    expect(response.status).toBe(200)

    const parsed = phoneResponseSchema.parse(await response.json())

    expect(parsed.phone).toBeNull()
  })

  test("rejects a phone number longer than 30 characters", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/me/phone",
      token: await tokenFor(1),
      method: "PUT",
      body: { phone: "0".repeat(31) },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/me/phone",
      token: null,
      method: "PUT",
      body: { phone: "090-1234-5678" },
    })

    expect(response.status).toBe(401)
  })
})
