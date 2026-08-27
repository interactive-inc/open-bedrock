import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedShiftPatterns } from "@/contexts/shift/test/seed/seed-shift-patterns.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "shift-patterns-create-route-test-secret"

const shiftPatternResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  break_minutes: z.number(),
})

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

  await seedD1(
    db,
    "shift_patterns",
    seedShiftPatterns.map((pattern) => ({
      id: pattern.id,
      code: pattern.code,
      name: pattern.name,
      start_time: pattern.startTime,
      end_time: pattern.endTime,
      break_minutes: pattern.breakMinutes,
    })),
  )
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

type RequestProps = {
  path: string
  token: string | null
  method?: string
  body?: unknown
}

async function request(props: RequestProps): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("POST /shift-patterns", () => {
  test("privileged role creates a pattern and returns 201", async () => {
    const response = await request({
      path: "/shift/shift-patterns",
      token: await tokenFor(1),
      method: "POST",
      body: {
        code: "SPLIT",
        name: "Split",
        start_time: "06:00",
        end_time: "20:00",
        break_minutes: 120,
      },
    })

    expect(response.status).toBe(201)

    const parsed = shiftPatternResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("SPLIT")
      expect(parsed.data.break_minutes).toBe(120)
    }
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift/shift-patterns",
      token: await tokenFor(5),
      method: "POST",
      body: { code: "SPLIT", name: "Split", start_time: "06:00", end_time: "20:00" },
    })

    expect(response.status).toBe(403)
  })

  test("duplicate code returns 409", async () => {
    const response = await request({
      path: "/shift/shift-patterns",
      token: await tokenFor(1),
      method: "POST",
      body: { code: "EARLY", name: "Duplicate", start_time: "07:00", end_time: "16:00" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 400 when code is missing", async () => {
    const response = await request({
      path: "/shift/shift-patterns",
      token: await tokenFor(1),
      method: "POST",
      body: { name: "Split", start_time: "06:00", end_time: "20:00" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift/shift-patterns",
      token: null,
      method: "POST",
      body: { code: "SPLIT", name: "Split", start_time: "06:00", end_time: "20:00" },
    })

    expect(response.status).toBe(401)
  })
})
