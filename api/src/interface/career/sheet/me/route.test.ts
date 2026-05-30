import { describe, expect, test } from "bun:test"
import { seedCareerSheets } from "@/infrastructure/seed/seed-career-sheets"
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

const jwtSecret = "career-sheet-me-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

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

describe("GET /career/sheet/me", () => {
  test("returns 200 with the sheet in snake_case shape", async () => {
    const response = await request({ path: "/career/sheet/me", token: await tokenForEmployee(5) })

    expect(response.status).toBe(200)

    const parsed = careerSheetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(5)
      expect(parsed.data.goals_text?.length).toBeGreaterThan(0)
      expect(parsed.data.strengths_text?.length).toBeGreaterThan(0)
    }
  })

  test("returns 200 with an empty sheet when none registered", async () => {
    const response = await request({ path: "/career/sheet/me", token: await tokenForEmployee(1) })

    expect(response.status).toBe(200)

    const parsed = careerSheetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(1)
      expect(parsed.data.goals_text).toBe(null)
      expect(parsed.data.strengths_text).toBe(null)
      expect(parsed.data.updated_at).toBe(null)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/career/sheet/me", token: null })

    expect(response.status).toBe(401)
  })
})
