import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(3)
})

afterAll(async () => {
  await pool.dispose()
})

const jwtSecret = "features-route-test-secret"

const availabilitySchema = z.object({ disabled_features: z.array(z.string()) })

async function createTestDb(): Promise<D1Database> {
  const db = await pool.next()

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
