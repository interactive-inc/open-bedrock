import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import {
  initializeCompanyMembershipTestState,
  initializeStandardCompanyTestState,
} from "@tests/api/support/initialize-standard-company-test-state"
import { z } from "zod"

const jwtSecret = "evaluation-sheet-create-test-secret"

const sheetSchema = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  template_id: z.number().nullable(),
  period: z.string(),
  status: z.string(),
  primary_evaluator_id: zEmployeeId,
  secondary_evaluator_id: zEmployeeId.nullable(),
  revision: z.number(),
  submitted_at: z.string().nullable(),
  approved_at: z.string().nullable(),
  finalized_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
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

  // migration sourceではemployee 5がemployee 1へreportする。
  await initializeCompanyMembershipTestState(db, [
    {
      employeeCode: seedEmployees[4].code, // employee 5
      departmentCode: "D003",
      managerEmployeeCode: seedEmployees[0].code, // employee 1
    },
  ])

  await initializeStandardCompanyTestState(db)

  return db
}

function hrToken(): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
}

function memberToken(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

async function createSheet(
  db: D1Database,
  body: Record<string, unknown>,
  token: string,
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/evaluation-sheets",
    token,
    method: "POST",
    body,
  })
}

describe("POST /evaluation-sheets", () => {
  test("creates a sheet with explicit primary evaluator", async () => {
    const db = await createTestDb()
    const token = await hrToken()

    const response = await createSheet(
      db,
      {
        employee_id: "5",
        period: "2026-H1",
        primary_evaluator_id: "1",
      },
      token,
    )

    expect(response.status).toBe(201)

    const body = sheetSchema.safeParse(await response.json())

    expect(body.success).toBe(true)

    if (body.success) {
      expect(body.data.employee_id).toBe(toWorkforceEmployeeId(5))
      expect(body.data.primary_evaluator_id).toBe(toWorkforceEmployeeId(1))
      expect(body.data.status).toBe("draft")
      expect(body.data.revision).toBe(1)
    }
  })

  test("auto-resolves primary evaluator from canonical Company organization", async () => {
    const db = await createTestDb()
    const token = await hrToken()

    const response = await createSheet(
      db,
      {
        employee_id: "5",
        period: "2026-H1",
      },
      token,
    )

    expect(response.status).toBe(201)

    const body = sheetSchema.safeParse(await response.json())

    expect(body.success).toBe(true)

    if (body.success) {
      expect(body.data.primary_evaluator_id).toBe(toWorkforceEmployeeId(1))
    }
  })

  test("rejects duplicate sheet for same employee and period", async () => {
    const db = await createTestDb()
    const token = await hrToken()

    const first = await createSheet(
      db,
      {
        employee_id: "5",
        period: "2026-H1",
        primary_evaluator_id: "1",
      },
      token,
    )

    expect(first.status).toBe(201)

    const second = await createSheet(
      db,
      {
        employee_id: "5",
        period: "2026-H1",
        primary_evaluator_id: "1",
      },
      token,
    )

    expect(second.status).toBe(409)
  })

  test("rejects self-evaluation (primary_evaluator_id = employee_id)", async () => {
    const db = await createTestDb()
    const token = await hrToken()

    const response = await createSheet(
      db,
      {
        employee_id: "5",
        period: "2026-H1",
        primary_evaluator_id: "5",
      },
      token,
    )

    expect(response.status).toBe(400)

    const body = (await response.json()) as { code: string }

    expect(body.code).toBe("self_evaluation_not_allowed")
  })

  test("rejects secondary_evaluator_id = primary_evaluator_id", async () => {
    const db = await createTestDb()
    const token = await hrToken()

    const response = await createSheet(
      db,
      {
        employee_id: "5",
        period: "2026-H1",
        primary_evaluator_id: "1",
        secondary_evaluator_id: "1",
      },
      token,
    )

    expect(response.status).toBe(400)

    const body = (await response.json()) as { code: string }

    expect(body.code).toBe("evaluator_conflict")
  })

  test("requires evaluation:administer permission", async () => {
    const db = await createTestDb()
    const token = await memberToken(5)

    const response = await createSheet(
      db,
      {
        employee_id: "5",
        period: "2026-H1",
        primary_evaluator_id: "1",
      },
      token,
    )

    expect(response.status).toBe(403)
  })
})
