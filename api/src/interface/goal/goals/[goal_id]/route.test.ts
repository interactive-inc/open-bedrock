import { describe, expect, test } from "bun:test"
import { seedGoalEvaluations } from "@/infrastructure/seed/seed-goal-evaluations"
import { seedGoals } from "@/infrastructure/seed/seed-goals"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
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

const jwtSecret = "goal-crud-route-test-secret"

// 社員 5 が持つ目標。確定評価なし。編集・削除できる。
const ownGoalId = 1

// 社員 9 が持つ目標。
const othersGoalId = 3

// 社員 9 が持つ目標で final 評価がある。確定済みで編集・削除不可。
const finalizedGoalId = 4

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

describe("GET /goals/me", () => {
  test("returns only the viewer's own goals", async () => {
    const response = await request({ path: "/goals/me", token: await tokenFor(5, "member") })

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

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/goals/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /goals/:goal_id", () => {
  test("returns the goal for its owner", async () => {
    const response = await request({
      path: `/goals/${ownGoalId}`,
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = goalResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(ownGoalId)
      expect(parsed.data.employee_id).toBe(5)
    }
  })

  test("privileged role can view another employee's goal", async () => {
    const response = await request({
      path: `/goals/${othersGoalId}`,
      token: await tokenFor(1, "admin"),
    })

    expect(response.status).toBe(200)
  })

  test("returns 403 for another person's goal as a member", async () => {
    const response = await request({
      path: `/goals/${othersGoalId}`,
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown goal", async () => {
    const response = await request({ path: "/goals/9999", token: await tokenFor(5, "member") })

    expect(response.status).toBe(404)
  })
})

describe("PUT /goals/:goal_id", () => {
  test("updates the definition of the viewer's goal", async () => {
    const response = await request({
      path: `/goals/${ownGoalId}`,
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { period: "2026-H2", title: "Updated goal", weight: 35, kpi: "New KPI" },
    })

    expect(response.status).toBe(200)

    const parsed = goalResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("Updated goal")
      expect(parsed.data.period).toBe("2026-H2")
      expect(parsed.data.weight).toBe(35)
      expect(parsed.data.kpi).toBe("New KPI")
    }
  })

  test("returns 403 when updating another person's goal", async () => {
    const response = await request({
      path: `/goals/${othersGoalId}`,
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { period: "2026-H2", title: "x", weight: 10 },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown goal", async () => {
    const response = await request({
      path: "/goals/9999",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { period: "2026-H2", title: "x", weight: 10 },
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when the goal is already finalized", async () => {
    const response = await request({
      path: `/goals/${finalizedGoalId}`,
      token: await tokenFor(9, "member"),
      method: "PUT",
      body: { period: "2026-H2", title: "x", weight: 10 },
    })

    expect(response.status).toBe(409)
  })

  test("returns 400 when title is empty", async () => {
    const response = await request({
      path: `/goals/${ownGoalId}`,
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { period: "2026-H2", title: "", weight: 10 },
    })

    expect(response.status).toBe(400)
  })
})

describe("DELETE /goals/:goal_id", () => {
  test("deletes the viewer's goal and returns 204", async () => {
    const response = await request({
      path: `/goals/${ownGoalId}`,
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when deleting another person's goal", async () => {
    const response = await request({
      path: `/goals/${othersGoalId}`,
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown goal", async () => {
    const response = await request({
      path: "/goals/9999",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when the goal is already finalized", async () => {
    const response = await request({
      path: `/goals/${finalizedGoalId}`,
      token: await tokenFor(9, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/goals/${ownGoalId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
