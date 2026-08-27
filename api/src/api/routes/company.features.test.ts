import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "features-route-test-secret"

const availabilitySchema = z.object({ disabled_features: z.array(z.string()) })

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
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

describe("GET /features", () => {
  test("returns an empty list when everything is enabled", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company/features",
      token: await tokenFor(5),
      enabledOptInApps: "all",
    })

    expect(response.status).toBe(200)

    const parsed = availabilitySchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.disabled_features).toEqual([])
    }
  })

  test("lists disabled optional and standard features", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company/features",
      token: await tokenFor(5),
      enabledOptInApps: "thanks",
      disabledDefaultApps: "rooms",
    })

    expect(response.status).toBe(200)

    const parsed = availabilitySchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.disabled_features).toContain("one-on-ones")
      expect(parsed.data.disabled_features).toContain("rooms")
      expect(parsed.data.disabled_features).not.toContain("thanks")
      expect(parsed.data.disabled_features).not.toContain("expenses")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company/features",
      token: null,
      enabledOptInApps: "all",
    })

    expect(response.status).toBe(401)
  })
})
