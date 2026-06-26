import { describe, expect, test } from "bun:test"
import { seedApplications } from "@/infrastructure/seed/seed-applications"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedGoals } from "@/infrastructure/seed/seed-goals"
import { seedSurveys } from "@/infrastructure/seed/seed-surveys"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "dashboard-route-test-secret"

const dashboardSummaryResponseSchema = z.object({
  employee_count: z.number(),
  open_goal_count: z.number(),
  pending_application_count: z.number(),
  open_survey_count: z.number(),
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
    "applications",
    seedApplications.map((application) => ({
      id: application.id,
      template_id: application.templateId,
      applicant_id: application.applicantId,
      status: application.status,
      current_step: application.currentStep,
      payload: JSON.stringify(application.payload),
      created_at: application.createdAt,
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
    role: "admin",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 3,
    email: "you+e003@example.com",
    role: "member",
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /dashboard", () => {
  test("returns 200 with deterministic aggregated counts", async () => {
    const response = await request("/dashboard", await adminToken())

    expect(response.status).toBe(200)

    const parsed = dashboardSummaryResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_count).toBe(14)
      expect(parsed.data.open_goal_count).toBe(5)
      expect(parsed.data.pending_application_count).toBe(3)
      expect(parsed.data.open_survey_count).toBe(2)
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
