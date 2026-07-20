import { describe, expect, test } from "bun:test"
import { seedSurveyResponses } from "@/infrastructure/seed/seed-survey-responses"
import { seedSurveys } from "@/infrastructure/seed/seed-surveys"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const surveyQuestionSummaryResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["scale", "choice", "text"]),
  distribution: z.record(z.string(), z.number()),
  answers: z.array(z.string()).readonly(),
})

const surveySummaryResponseSchema = z.object({
  survey_id: z.number(),
  title: z.string(),
  response_count: z.number(),
  is_truncated: z.boolean(),
  questions: z.array(surveyQuestionSummaryResponseSchema).readonly(),
})

const jwtSecret = "survey-summary-route-test-secret"

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
    "surveys",
    seedSurveys.map((survey) => ({
      id: survey.id,
      title: survey.title,
      status: survey.status,
      questions_json: JSON.stringify(survey.questionsJson),
    })),
  )

  await seedD1(
    db,
    "survey_responses",
    seedSurveyResponses.map((response) => ({
      id: response.id,
      survey_id: response.surveyId,
      respondent_id: response.respondentId,
      answers_json: JSON.stringify(response.answersJson),
      submitted_at: response.submittedAt,
    })),
  )

  return db
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 13,
    email: "you+e013@example.com",
    role: "member",
  })
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
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

describe("GET /surveys/:survey_id/summary", () => {
  test("returns 200 with an aggregated snake_case summary", async () => {
    const response = await request({ path: "/surveys/1/summary", token: await adminToken() })

    expect(response.status).toBe(200)

    const parsed = surveySummaryResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.survey_id).toBe(1)
      expect(parsed.data.response_count).toBe(3)
      expect(parsed.data.is_truncated).toBe(false)
      expect(parsed.data.questions.length).toBe(3)

      const scale = parsed.data.questions.find((question) => question.id === "q1")

      expect(scale?.distribution["4"]).toBe(1)
      expect(scale?.distribution["5"]).toBe(1)
      expect(scale?.distribution["3"]).toBe(1)

      const free = parsed.data.questions.find((question) => question.id === "q3")

      expect(free?.answers.length).toBe(2)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/surveys/1/summary", token: null })

    expect(response.status).toBe(401)
  })

  test("returns 403 for a non-privileged role (free-text answers are not exposed)", async () => {
    const response = await request({ path: "/surveys/1/summary", token: await memberToken() })

    expect(response.status).toBe(403)
  })

  test("returns 404 when the survey does not exist", async () => {
    const response = await request({ path: "/surveys/9999/summary", token: await adminToken() })

    expect(response.status).toBe(404)
  })
})
