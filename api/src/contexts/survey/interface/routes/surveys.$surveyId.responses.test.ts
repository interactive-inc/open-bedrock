import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedSurveyResponses } from "@/contexts/survey/test/seed/seed-survey-responses.test-support"
import { seedSurveys } from "@/contexts/survey/test/seed/seed-surveys.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const surveySubmissionResponseSchema = z.object({
  id: z.number(),
  survey_id: z.number(),
  respondent_id: zEmployeeId,
  answers_json: z.unknown(),
  submitted_at: z.string(),
})

const jwtSecret = "survey-responses-route-test-secret"

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
  await initializeStandardCompanyTestState(db)

  return db
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(13),
  })
}

function repeaterToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(5),
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

describe("POST /surveys/:surveyId/responses", () => {
  test("returns 201 with the created snake_case response", async () => {
    const response = await request({
      path: "/survey/surveys/2/responses",
      token: await memberToken(),
      method: "POST",
      body: { answers_json: { q1: 4, q2: "1 day/week" } },
    })

    expect(response.status).toBe(201)

    const parsed = surveySubmissionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.survey_id).toBe(2)
      expect(parsed.data.respondent_id).toBe(toWorkforceEmployeeId(13))
      expect(parsed.data.submitted_at).toBe("2026-01-01T00:00:00.000Z")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/survey/surveys/2/responses",
      token: null,
      method: "POST",
      body: { answers_json: { q1: 4 } },
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 when answers_json is missing", async () => {
    const response = await request({
      path: "/survey/surveys/2/responses",
      token: await memberToken(),
      method: "POST",
      body: {},
    })

    expect(response.status).toBe(400)
  })

  test("returns 404 when the survey does not exist", async () => {
    const response = await request({
      path: "/survey/surveys/9999/responses",
      token: await memberToken(),
      method: "POST",
      body: { answers_json: { q1: 4 } },
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when the survey is not open", async () => {
    const response = await request({
      path: "/survey/surveys/3/responses",
      token: await memberToken(),
      method: "POST",
      body: { answers_json: { q1: 4 } },
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when the respondent already submitted", async () => {
    const response = await request({
      path: "/survey/surveys/1/responses",
      token: await repeaterToken(),
      method: "POST",
      body: { answers_json: { q1: 4 } },
    })

    expect(response.status).toBe(409)
  })
})
