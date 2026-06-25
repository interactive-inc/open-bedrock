import { describe, expect, test } from "bun:test"
import { seedCareerSheets } from "@/infrastructure/seed/seed-career-sheets"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const careerSheetResponseSchema = z.object({
  employee_id: z.number(),
  goals_text: z.string().nullable(),
  strengths_text: z.string().nullable(),
  updated_at: z.string().nullable(),
})

const jwtSecret = "career-sheet-me-update-route-test-secret"

const nowValue = "2026-01-01T00:00:00.000Z"

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
    "career_sheets",
    seedCareerSheets.map((sheet) => ({
      employee_id: sheet.employeeId,
      goals_text: sheet.goalsText,
      strengths_text: sheet.strengthsText,
      updated_at: sheet.updatedAt,
    })),
  )

  return db
}

function tokenForEmployee(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: "member",
  })
}

async function request(props: {
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("PUT /career/sheet/me", () => {
  test("returns 200 with the upserted sheet", async () => {
    const response = await request({
      path: "/career/sheet/me",
      token: await tokenForEmployee(1),
      method: "PUT",
      body: { goals_text: "Aim to become a PdM", strengths_text: "Requirements definition" },
    })

    expect(response.status).toBe(200)

    const parsed = careerSheetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(1)
      expect(parsed.data.goals_text).toBe("Aim to become a PdM")
      expect(parsed.data.strengths_text).toBe("Requirements definition")
      expect(parsed.data.updated_at).toBe(nowValue)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/career/sheet/me",
      token: null,
      method: "PUT",
      body: { goals_text: "x" },
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 when the body is the wrong shape", async () => {
    const response = await request({
      path: "/career/sheet/me",
      token: await tokenForEmployee(1),
      method: "PUT",
      body: { goals_text: 123 },
    })

    expect(response.status).toBe(400)
  })
})
