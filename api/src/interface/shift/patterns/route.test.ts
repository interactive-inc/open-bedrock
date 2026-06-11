import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedShiftPatterns } from "@/infrastructure/seed/seed-shift-patterns"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const jwtSecret = "shift-patterns-list-route-test-secret"

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

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

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

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
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

describe("GET /shift/patterns", () => {
  test("returns 200 with all patterns", async () => {
    const response = await request({ path: "/shift/patterns", token: await tokenFor(4, "manager") })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(shiftPatternResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/shift/patterns", token: null })

    expect(response.status).toBe(401)
  })
})
