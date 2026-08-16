import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedGoals } from "@/contexts/company/infrastructure/seed/seed-goals"
import { seedSurveys } from "@/contexts/company/infrastructure/seed/seed-surveys"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "dashboard-route-test-secret"

const dashboardSummaryResponseSchema = z.object({
  employee_count: z.number(),
  open_goal_count: z.number(),
  pending_application_count: z.number(),
  open_survey_count: z.number(),
  department_breakdown: z.array(z.object({ dept_name: z.string(), count: z.number() })),
  goal_status_summary: z.object({
    draft: z.number(),
    in_progress: z.number(),
    completed: z.number(),
  }),
  goal_completion_rate: z.number(),
  application_trend: z.array(z.object({ month: z.string(), count: z.number() })),
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
    "system_cases",
    ["pending", "pending", "approved", "rejected", "pending"].map((status, index) => ({
      id: `dashboard-case-${index + 1}`,
      subject_context: "system",
      subject_kind: "dashboard-example",
      subject_id: String(index + 1),
      subject_version: "1",
      proposal_digest: "a".repeat(64),
      created_by_account_id: "1",
      status,
      created_at: Date.parse(`2026-05-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
      updated_at: Date.parse(`2026-05-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
    })),
  )

  await seedD1(
    db,
    "surveys",
    seedSurveys.map((survey) => ({
      id: survey.id,
      title: survey.title,
      status: survey.status,
      questions_json: JSON.stringify(survey.questionsJson),
    })),
  )

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "root",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 3,
    email: "you+e003@example.com",
    role: "member",
  })
}

/** NOW を 2026-06-01 に固定し、seed の申請データ（2026-05 月）が直近 6 か月の窓に入るようにする。 */
const testNow = "2026-06-01T00:00:00.000Z"

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token, now: testNow })
}

describe("GET /dashboard", () => {
  test("returns 200 with deterministic aggregated counts", async () => {
    const response = await request("/dashboard", await adminToken())

    expect(response.status).toBe(200)

    const parsed = dashboardSummaryResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // 既存 4 カウント
      expect(parsed.data.employee_count).toBe(14)
      expect(parsed.data.open_goal_count).toBe(5)
      expect(parsed.data.pending_application_count).toBe(3)
      expect(parsed.data.open_survey_count).toBe(2)

      // 部署別内訳: 合計が employee_count と一致する
      const deptTotal = parsed.data.department_breakdown.reduce((sum, d) => sum + d.count, 0)
      expect(deptTotal).toBe(14)
      expect(parsed.data.department_breakdown.length).toBeGreaterThanOrEqual(1)

      // 目標ステータス: seed は draft=2, in_progress=5, completed=1 の計 8 件
      expect(parsed.data.goal_status_summary.draft).toBe(2)
      expect(parsed.data.goal_status_summary.in_progress).toBe(5)
      expect(parsed.data.goal_status_summary.completed).toBe(1)

      // 完了率: 1/8 = 12.5%
      expect(parsed.data.goal_completion_rate).toBe(12.5)

      // 申請月別推移: 6 か月分のエントリが返る（NOW=2026-06 → 2026-01..2026-06）
      expect(parsed.data.application_trend).toHaveLength(6)

      // seed の申請は全て 2026-05 月 → 2026-05 のバケットに 5 件
      const may = parsed.data.application_trend.find((t) => t.month === "2026-05")
      expect(may?.count).toBe(5)

      // 他の月は 0
      const otherMonths = parsed.data.application_trend.filter((t) => t.month !== "2026-05")

      for (const m of otherMonths) {
        expect(m.count).toBe(0)
      }
    }
  })

  test("returns 403 for member role", async () => {
    const response = await request("/dashboard", await memberToken())

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/dashboard", null)

    expect(response.status).toBe(401)
  })

  test("returns 401 with an invalid bearer token", async () => {
    const response = await request("/dashboard", "not-a-real-token")

    expect(response.status).toBe(401)
  })
})
