import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { seedShiftPatterns } from "@/contexts/shift/infrastructure/seed/seed-shift-patterns"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

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

describe("POST /shift-patterns", () => {
  test("privileged role creates a pattern and returns 201", async () => {
    const response = await request({
      path: "/shift-patterns",
      token: await tokenFor(1, "root"),
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
      path: "/shift-patterns",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { code: "SPLIT", name: "Split", start_time: "06:00", end_time: "20:00" },
    })

    expect(response.status).toBe(403)
  })

  test("duplicate code returns 409", async () => {
    const response = await request({
      path: "/shift-patterns",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { code: "EARLY", name: "Duplicate", start_time: "07:00", end_time: "16:00" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 400 when code is missing", async () => {
    const response = await request({
      path: "/shift-patterns",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { name: "Split", start_time: "06:00", end_time: "20:00" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift-patterns",
      token: null,
      method: "POST",
      body: { code: "SPLIT", name: "Split", start_time: "06:00", end_time: "20:00" },
    })

    expect(response.status).toBe(401)
  })
})
