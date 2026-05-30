import { describe, expect, test } from "bun:test"
import { seedGoalEvaluations } from "@/infrastructure/seed/seed-goal-evaluations"
import { seedGoals } from "@/infrastructure/seed/seed-goals"
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

describe("POST /goals/:goal_id/evaluations", () => {
  test("owner can add a self evaluation and returns 201", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals/4/evaluations",
      token: await tokenFor(9, "member"),
      method: "POST",
      body: { kind: "self", score: 80, comment: "On track" },
    })

    expect(response.status).toBe(201)

    const parsed = goalEvaluationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.goal_id).toBe(4)
      expect(parsed.data.evaluator_id).toBe(9)
      expect(parsed.data.kind).toBe("self")
      expect(parsed.data.score).toBe(80)
      expect(parsed.data.created_at).toBe(fixedNow)
    }
  })

  test("final evaluation by a manager flips goal status to done", async () => {
    const db = await createTestDb()

    const evaluateResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/goals/4/evaluations",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { kind: "final", score: 90 },
    })

    expect(evaluateResponse.status).toBe(201)

    const listResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/goals?employee_id=9&period=2025-H2",
      token: await tokenFor(9, "member"),
    })

    const parsed = z.array(goalResponseSchema).safeParse(await listResponse.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data[0]?.id).toBe(4)
      expect(parsed.data[0]?.status).toBe("done")
    }
  })

  test("non-owner self evaluation is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals/4/evaluations",
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
      path: "/goals/4/evaluations",
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
      path: "/goals/9999/evaluations",
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: { kind: "final", score: 90 },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when kind is invalid", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals/4/evaluations",
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: { kind: "bogus" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals/4/evaluations",
      token: null,
      method: "POST",
      body: { kind: "self" },
    })

    expect(response.status).toBe(401)
  })
})
