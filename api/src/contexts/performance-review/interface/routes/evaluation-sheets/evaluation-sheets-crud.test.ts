import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "evaluation-sheets-crud-test-secret"

const sheetSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  template_id: z.number().nullable(),
  period: z.string(),
  status: z.string(),
  primary_evaluator_id: z.number(),
  secondary_evaluator_id: z.number().nullable(),
  revision: z.number(),
  submitted_at: z.string().nullable(),
  approved_at: z.string().nullable(),
  finalized_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

const listSchema = z.object({
  data: z.array(sheetSchema),
  total: z.number(),
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

  // Seed org_memberships for manager resolution (employee 5 reports to employee 1)
  await seedD1(db, "org_memberships", [
    {
      employee_code: seedEmployees[4].code, // employee 5 (E005)
      department_code: "D001",
      manager_employee_code: seedEmployees[0].code, // employee 1 (E001)
    },
  ])

  return db
}

/** root (employee 1) — has evaluation:administer */
function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: 1, email: "admin@example.com" })
}

/** member (employee 5) — no evaluation:administer */
function ownerToken(): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: 5, email: "owner@example.com" })
}

async function createSheet(
  db: D1Database,
  overrides?: Record<string, unknown>,
): Promise<{ id: number; revision: number }> {
  const token = await adminToken()
  const body = {
    employee_id: 5,
    period: "2026-H1",
    primary_evaluator_id: 1,
    ...overrides,
  }

  const response = await requestWithContext({
    db,
    jwtSecret,
    path: "/evaluation-sheets",
    token,
    method: "POST",
    body,
  })

  if (response.status !== 201) {
    throw new Error(`Failed to create sheet: ${response.status}`)
  }

  const json = (await response.json()) as { id: number; revision: number }

  return json
}

// ---------------------------------------------------------------------------
// GET /evaluation-sheets — admin list
// ---------------------------------------------------------------------------
describe("GET /evaluation-sheets", () => {
  test("lists sheets for admin", async () => {
    const db = await createTestDb()
    await createSheet(db)

    const token = await adminToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token,
      method: "GET",
    })

    expect(response.status).toBe(200)

    const body = listSchema.safeParse(await response.json())

    expect(body.success).toBe(true)

    if (body.success) {
      expect(body.data.total).toBe(1)
      expect(body.data.data[0].revision).toBeGreaterThanOrEqual(1)
    }
  })

  test("rejects member without evaluation:administer", async () => {
    const db = await createTestDb()
    const token = await ownerToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token,
      method: "GET",
    })

    expect(response.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// GET /evaluation-sheets/me — owner list
// ---------------------------------------------------------------------------
describe("GET /evaluation-sheets/me", () => {
  test("lists own sheets", async () => {
    const db = await createTestDb()
    await createSheet(db)

    const token = await ownerToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets/me",
      token,
      method: "GET",
    })

    expect(response.status).toBe(200)

    const body = listSchema.safeParse(await response.json())

    expect(body.success).toBe(true)

    if (body.success) {
      expect(body.data.total).toBe(1)
      expect(body.data.data[0].employee_id).toBe(5)
      expect(body.data.data[0].revision).toBeGreaterThanOrEqual(1)
    }
  })

  test("filters by period", async () => {
    const db = await createTestDb()
    await createSheet(db, { period: "2026-H1" })
    await createSheet(db, { period: "2026-H2" })

    const token = await ownerToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets/me?period=2026-H1",
      token,
      method: "GET",
    })

    expect(response.status).toBe(200)

    const body = listSchema.safeParse(await response.json())

    expect(body.success).toBe(true)

    if (body.success) {
      expect(body.data.total).toBe(1)
      expect(body.data.data[0].period).toBe("2026-H1")
    }
  })
})

/** ヘルパー: シートに weight 合計 100% の目標をセットする（submit に必須） */
async function seedGoals(db: D1Database, sheetId: number): Promise<void> {
  const token = await ownerToken()
  const res = await requestWithContext({
    db,
    jwtSecret,
    path: "/performance-goals",
    token,
    method: "POST",
    body: { period: "2026-H1", title: "Goal", weight: 100, evaluation_sheet_id: sheetId },
  })
  if (res.status !== 201) {
    throw new Error(`seedGoals failed: ${res.status}`)
  }
}

// ---------------------------------------------------------------------------
// POST /evaluation-sheets/:sheet_id/transition
// ---------------------------------------------------------------------------
describe("POST /evaluation-sheets/:sheet_id/transition", () => {
  test("owner can submit (draft → pending_approval)", async () => {
    const db = await createTestDb()
    const sheet = await createSheet(db)
    await seedGoals(db, sheet.id)

    const token = await ownerToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet.id}/transition`,
      token,
      method: "POST",
      body: {
        status: "pending_approval",
        expected_revision: sheet.revision,
      },
    })

    expect(response.status).toBe(200)

    const body = sheetSchema.safeParse(await response.json())

    expect(body.success).toBe(true)

    if (body.success) {
      expect(body.data.status).toBe("pending_approval")
      expect(body.data.revision).toBe(sheet.revision + 1)
    }
  })

  test("rejects stale expected_revision (CAS)", async () => {
    const db = await createTestDb()
    const sheet = await createSheet(db)

    const token = await ownerToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet.id}/transition`,
      token,
      method: "POST",
      body: {
        status: "pending_approval",
        expected_revision: sheet.revision + 999,
      },
    })

    expect(response.status).toBe(409)
  })

  test("evaluator can approve (pending_approval → approved)", async () => {
    const db = await createTestDb()
    const sheet = await createSheet(db)
    await seedGoals(db, sheet.id)

    // First: owner submits
    const ownerTk = await ownerToken()
    const submitRes = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet.id}/transition`,
      token: ownerTk,
      method: "POST",
      body: {
        status: "pending_approval",
        expected_revision: sheet.revision,
      },
    })

    expect(submitRes.status).toBe(200)

    const submitted = (await submitRes.json()) as { revision: number }

    // Then: evaluator (employee 1) approves
    const adminTk = await adminToken()
    const approveRes = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet.id}/transition`,
      token: adminTk,
      method: "POST",
      body: {
        status: "approved",
        expected_revision: submitted.revision,
      },
    })

    expect(approveRes.status).toBe(200)

    const approved = sheetSchema.safeParse(await approveRes.json())

    expect(approved.success).toBe(true)

    if (approved.success) {
      expect(approved.data.status).toBe("approved")
    }
  })

  test("non-owner non-evaluator cannot transition", async () => {
    const db = await createTestDb()
    const sheet = await createSheet(db)

    // Employee 6 is a member with no relation to the sheet
    const otherToken = await createTestToken(jwtSecret, {
      employeeId: 6,
      email: "other@example.com",
    })

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet.id}/transition`,
      token: otherToken,
      method: "POST",
      body: {
        status: "pending_approval",
        expected_revision: sheet.revision,
      },
    })

    expect(response.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// PUT /evaluation-sheets/:sheet_id/evaluators
// ---------------------------------------------------------------------------
describe("PUT /evaluation-sheets/:sheet_id/evaluators", () => {
  test("admin can change evaluators", async () => {
    const db = await createTestDb()
    const sheet = await createSheet(db)

    const token = await adminToken()

    // Change primary evaluator from 1 to 4 (Drew Sato, a different employee)
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet.id}/evaluators`,
      token,
      method: "PUT",
      body: {
        primary_evaluator_id: 4,
        expected_revision: sheet.revision,
      },
    })

    expect(response.status).toBe(200)

    const body = sheetSchema.safeParse(await response.json())

    expect(body.success).toBe(true)

    if (body.success) {
      expect(body.data.primary_evaluator_id).toBe(4)
      expect(body.data.revision).toBe(sheet.revision + 1)
    }
  })

  test("rejects stale expected_revision (CAS)", async () => {
    const db = await createTestDb()
    const sheet = await createSheet(db)

    const token = await adminToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet.id}/evaluators`,
      token,
      method: "PUT",
      body: {
        primary_evaluator_id: 4,
        expected_revision: sheet.revision + 999,
      },
    })

    expect(response.status).toBe(409)
  })

  test("rejects self-evaluation", async () => {
    const db = await createTestDb()
    const sheet = await createSheet(db)

    const token = await adminToken()

    // Try to set primary evaluator to the employee themselves (5)
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet.id}/evaluators`,
      token,
      method: "PUT",
      body: {
        primary_evaluator_id: 5,
        expected_revision: sheet.revision,
      },
    })

    expect(response.status).toBe(400)
  })

  test("rejects same primary and secondary evaluator", async () => {
    const db = await createTestDb()
    const sheet = await createSheet(db)

    const token = await adminToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet.id}/evaluators`,
      token,
      method: "PUT",
      body: {
        primary_evaluator_id: 4,
        secondary_evaluator_id: 4,
        expected_revision: sheet.revision,
      },
    })

    expect(response.status).toBe(400)
  })

  test("rejects non-existent evaluator", async () => {
    const db = await createTestDb()
    const sheet = await createSheet(db)

    const token = await adminToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet.id}/evaluators`,
      token,
      method: "PUT",
      body: {
        primary_evaluator_id: 9999,
        expected_revision: sheet.revision,
      },
    })

    expect(response.status).toBe(400)
  })

  test("member cannot change evaluators", async () => {
    const db = await createTestDb()
    const sheet = await createSheet(db)

    const token = await ownerToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet.id}/evaluators`,
      token,
      method: "PUT",
      body: {
        primary_evaluator_id: 4,
        expected_revision: sheet.revision,
      },
    })

    expect(response.status).toBe(403)
  })
})
