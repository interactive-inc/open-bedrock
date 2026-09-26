import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedCareerSheets } from "@/contexts/career/test/seed/seed-career-sheets.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(6)
})

afterAll(async () => {
  await pool.dispose()
})

const careerSheetResponseSchema = z.object({
  employee_id: zEmployeeId,
  goals_text: z.string().nullable(),
  strengths_text: z.string().nullable(),
  updated_at: z.string().nullable(),
})

const jwtSecret = "career-sheet-me-route-test-secret"

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
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenForEmployee(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
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

describe("GET /career-sheets/me", () => {
  test("returns 200 with the sheet in snake_case shape", async () => {
    const response = await request({
      path: "/career/career-sheets/me",
      token: await tokenForEmployee(5),
    })

    expect(response.status).toBe(200)

    const parsed = careerSheetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(toWorkforceEmployeeId(testEmployeeId(5)))
      expect(parsed.data.goals_text?.length).toBeGreaterThan(0)
      expect(parsed.data.strengths_text?.length).toBeGreaterThan(0)
    }
  })

  test("returns 200 with an empty sheet when none registered", async () => {
    const response = await request({
      path: "/career/career-sheets/me",
      token: await tokenForEmployee(1),
    })

    expect(response.status).toBe(200)

    const parsed = careerSheetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(toWorkforceEmployeeId(testEmployeeId(1)))
      expect(parsed.data.goals_text).toBe(null)
      expect(parsed.data.strengths_text).toBe(null)
      expect(parsed.data.updated_at).toBe(null)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/career/career-sheets/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("DELETE /career-sheets/me", () => {
  test("deletes the sheet and returns 204", async () => {
    const response = await request({
      path: "/career/career-sheets/me",
      token: await tokenForEmployee(5),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 204 even when no sheet is registered", async () => {
    const response = await request({
      path: "/career/career-sheets/me",
      token: await tokenForEmployee(1),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/career/career-sheets/me",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
