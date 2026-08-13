import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "features-route-test-secret"

const availabilitySchema = z.object({ disabled_features: z.array(z.string()) })

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

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: "member",
  })
}

describe("GET /features", () => {
  test("returns an empty list when everything is enabled", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/features",
      token: await tokenFor(5),
      enabledOptionalFeatures: "all",
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
      path: "/features",
      token: await tokenFor(5),
      enabledOptionalFeatures: "thanks",
      disabledStandardFeatures: "rooms",
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
      path: "/features",
      token: null,
      enabledOptionalFeatures: "all",
    })

    expect(response.status).toBe(401)
  })
})
