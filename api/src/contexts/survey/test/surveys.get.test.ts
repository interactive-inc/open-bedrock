import { describe, expect, test } from "bun:test"
import { seedSurveyResponses } from "@/contexts/survey/infrastructure/seed/seed-survey-responses.repository"
import { seedSurveys } from "@/contexts/survey/infrastructure/seed/seed-surveys.repository"
import { seedEmployees } from "@/api/test/support/company/seed-employees.repository"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@/api/test/support/initialize-standard-company-test-state"

const surveyListItemResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.enum(["open", "closed"]),
  questions_json: z.array(z.unknown()).readonly(),
})

const jwtSecret = "survey-surveys-route-test-secret"

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
  await initializeStandardCompanyTestState(db)

  return db
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 13,
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

describe("GET /surveys", () => {
  test("returns 200 with open surveys carrying questions_json", async () => {
    const response = await request({ path: "/surveys", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(surveyListItemResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)

      for (const survey of parsed.data.data) {
        expect(survey.status).toBe("open")
        expect(Array.isArray(survey.questions_json)).toBe(true)
      }
    }
  })

  test("returns only 1 survey when limit=1", async () => {
    const response = await request({ path: "/surveys?limit=1", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(surveyListItemResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.status).toBe("open")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/surveys", token: null })

    expect(response.status).toBe(401)
  })
})
