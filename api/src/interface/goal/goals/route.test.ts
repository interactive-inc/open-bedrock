import { describe, expect, test } from "bun:test"
import { seedGoalEvaluations } from "@/infrastructure/seed/seed-goal-evaluations"
import { seedGoals } from "@/infrastructure/seed/seed-goals"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
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

const jwtSecret = "goal-list-route-test-secret"

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
    "goals",
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

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

describe("GET /goals", () => {
  test("returns 200 with the viewer's own goals by default", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.data.every((goal) => goal.employee_id === 5)).toBe(true)
    }
  })

  test("filters own goals by period", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals?period=2025-H2",
      token: await tokenFor(9, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.id).toBe(4)
    }
  })

  test("privileged role can read another employee via employee_id", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals?employee_id=5",
      token: await tokenFor(1, "admin"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.data.every((goal) => goal.employee_id === 5)).toBe(true)
    }
  })

  test("member requesting another employee_id is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals?employee_id=9",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals",
      token: null,
    })

    expect(response.status).toBe(401)
  })

  test("returns 401 with an invalid bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals",
      token: "not-a-real-token",
    })

    expect(response.status).toBe(401)
  })
})
