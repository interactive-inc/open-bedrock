import { describe, expect, test } from "bun:test"
import { seedSurveyResponses } from "@/infrastructure/seed/seed-survey-responses"
import { seedSurveys } from "@/infrastructure/seed/seed-surveys"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const surveySubmissionResponseSchema = z.object({
  id: z.number(),
  survey_id: z.number(),
  respondent_id: z.string(),
  answers_json: z.unknown(),
  submitted_at: z.string(),
})

const jwtSecret = "survey-responses-route-test-secret"

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

function repeaterToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
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

describe("POST /surveys/:survey_id/responses", () => {
  test("returns 201 with the created snake_case response", async () => {
    const response = await request({
      path: "/surveys/2/responses",
      token: await memberToken(),
      method: "POST",
      body: { answers_json: { q1: 4, q2: "1 day/week" } },
    })

    expect(response.status).toBe(201)

    const parsed = surveySubmissionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.survey_id).toBe(2)
      expect(parsed.data.respondent_id).toBe("13")
      expect(parsed.data.submitted_at).toBe("2026-01-01T00:00:00.000Z")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/surveys/2/responses",
      token: null,
      method: "POST",
      body: { answers_json: { q1: 4 } },
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 when answers_json is missing", async () => {
    const response = await request({
      path: "/surveys/2/responses",
      token: await memberToken(),
      method: "POST",
      body: {},
    })

    expect(response.status).toBe(400)
  })

  test("returns 404 when the survey does not exist", async () => {
    const response = await request({
      path: "/surveys/9999/responses",
      token: await memberToken(),
      method: "POST",
      body: { answers_json: { q1: 4 } },
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when the survey is not open", async () => {
    const response = await request({
      path: "/surveys/3/responses",
      token: await memberToken(),
      method: "POST",
      body: { answers_json: { q1: 4 } },
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when the respondent already submitted", async () => {
    const response = await request({
      path: "/surveys/1/responses",
      token: await repeaterToken(),
      method: "POST",
      body: { answers_json: { q1: 4 } },
    })

    expect(response.status).toBe(409)
  })
})
