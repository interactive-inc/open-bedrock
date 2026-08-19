import { describe, expect, test } from "bun:test"
import { seedGoalEvaluations } from "@/contexts/performance-review/infrastructure/seed/seed-goal-evaluations"
import { seedGoals } from "@/contexts/performance-review/infrastructure/seed/seed-goals"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedOrgMemberships } from "@/contexts/company/infrastructure/seed/seed-org-memberships"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { verifyStandardCompanyMigration } from "@/api/test/support/verify-standard-company-migration"
import { z } from "zod"

const goalResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  period: z.string(),
  title: z.string(),
  kpi: z.string().nullable(),
  weight: z.number(),
  status: z.string(),
})

const goalEvaluationResponseSchema = z.object({
  id: z.number(),
  goal_id: z.number(),
  evaluator_id: z.number(),
  kind: z.enum(["self", "manager", "final"]),
  score: z.number().nullable(),
  comment: z.string().nullable(),
  created_at: z.string(),
})

const jwtSecret = "goal-evaluations-route-test-secret"

const fixedNow = "2026-01-01T00:00:00.000Z"

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
    "org_memberships",
    seedOrgMemberships.map((membership) => ({
      department_code: membership.departmentCode,
      employee_code: membership.employeeCode,
      manager_employee_code: membership.managerEmployeeCode,
    })),
  )

  await seedD1(
    db,
    "performance_goals",
    seedGoals.map((goal) => ({
      id: goal.id,
      employee_id: goal.employeeId,
      period: goal.period,
      title: goal.title,
      kpi: goal.kpi,
      weight: goal.weight,
      status: goal.status,
    })),
  )

  await seedD1(
    db,
    "goal_evaluations",
    seedGoalEvaluations.map((evaluation) => ({
      id: evaluation.id,
      goal_id: evaluation.goalId,
      evaluator_id: evaluation.evaluatorId,
      kind: evaluation.kind,
      score: evaluation.score,
      comment: evaluation.comment,
      created_at: evaluation.createdAt,
    })),
  )

  await verifyStandardCompanyMigration(db)

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

describe("GET /performance-goals/:goalId/evaluations", () => {
  test("owner can list evaluations in creation order", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: await tokenFor(9, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z.array(goalEvaluationResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(3)
      expect(parsed.data.map((evaluation) => evaluation.id)).toEqual([1, 2, 3])
      expect(parsed.data.map((evaluation) => evaluation.kind)).toEqual(["self", "manager", "final"])
      expect(parsed.data.every((evaluation) => evaluation.goal_id === 4)).toBe(true)
    }
  })

  test("privileged role can list another employee's goal evaluations", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)
  })

  test("returns an empty list when the goal has no evaluations", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/3/evaluations",
      token: await tokenFor(9, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z.array(goalEvaluationResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(0)
    }
  })

  test("returns 403 for another person's goal as a member", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 when the goal does not exist", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/9999/evaluations",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /performance-goals/:goalId/evaluations", () => {
  test("owner can add a self evaluation and returns 201", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/3/evaluations",
      token: await tokenFor(9, "member"),
      method: "POST",
      body: { kind: "self", score: 80, comment: "On track" },
    })

    expect(response.status).toBe(201)

    const parsed = goalEvaluationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.goal_id).toBe(3)
      expect(parsed.data.evaluator_id).toBe(9)
      expect(parsed.data.kind).toBe("self")
      expect(parsed.data.score).toBe(80)
      expect(parsed.data.created_at).toBe(fixedNow)
    }
  })

  test("final evaluation by the report's manager flips goal status to done", async () => {
    const db = await createTestDb()

    // 目標1 は E005(id 5)。その上長 E004(id 4, manager) が final 評価できる。
    const evaluateResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals/1/evaluations",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { kind: "final", score: 90 },
    })

    expect(evaluateResponse.status).toBe(201)

    const listResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals?employee_id=5&period=2026-H1",
      token: await tokenFor(1, "root"),
    })

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await listResponse.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const finalized = parsed.data.data.find((goal) => goal.id === 1)
      expect(finalized?.status).toBe("done")
    }
  })

  test("manager cannot evaluate a non-report's goal", async () => {
    // 目標3 は E009(id 9)。E009 の上長は E001 で、E004(id 4) は配下に含まない。
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/3/evaluations",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { kind: "final", score: 90 },
    })

    expect(response.status).toBe(403)
  })

  test("non-owner self evaluation is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { kind: "self", score: 50 },
    })

    expect(response.status).toBe(403)
  })

  test("member cannot add a manager evaluation", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: await tokenFor(9, "member"),
      method: "POST",
      body: { kind: "manager", score: 70 },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 when the goal does not exist", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/9999/evaluations",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { kind: "final", score: 90 },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when score is negative", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: await tokenFor(9, "member"),
      method: "POST",
      body: { kind: "self", score: -1, comment: "negative" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when score exceeds 100", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: await tokenFor(9, "member"),
      method: "POST",
      body: { kind: "self", score: 101, comment: "too high" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when score is not an integer", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: await tokenFor(9, "member"),
      method: "POST",
      body: { kind: "self", score: 50.5, comment: "decimal" },
    })

    expect(response.status).toBe(400)
  })

  test("accepts score at boundary 0", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/3/evaluations",
      token: await tokenFor(9, "member"),
      method: "POST",
      body: { kind: "self", score: 0, comment: "minimum" },
    })

    expect(response.status).toBe(201)
  })

  test("accepts score at boundary 100", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/3/evaluations",
      token: await tokenFor(9, "member"),
      method: "POST",
      body: { kind: "self", score: 100, comment: "maximum" },
    })

    expect(response.status).toBe(201)
  })

  test("returns 400 when kind is invalid", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { kind: "bogus" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: null,
      method: "POST",
      body: { kind: "self" },
    })

    expect(response.status).toBe(401)
  })

  test("returns 409 when same evaluator and kind already exists for the goal", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-goals/4/evaluations",
      token: await tokenFor(9, "member"),
      method: "POST",
      body: { kind: "self", score: 75, comment: "duplicate attempt" },
    })

    expect(response.status).toBe(409)
  })
})
