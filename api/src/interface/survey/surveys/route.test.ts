import { describe, expect, test } from "bun:test"
import { seedSurveyResponses } from "@/infrastructure/seed/seed-survey-responses"
import { seedSurveys } from "@/infrastructure/seed/seed-surveys"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

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
    employeeId: 99,
    email: "you+e099@example.com",
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

describe("GET /surveys", () => {
  test("returns 200 with open surveys carrying questions_json", async () => {
    const response = await request({ path: "/surveys", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z.array(surveyListItemResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(2)

      for (const survey of parsed.data) {
        expect(survey.status).toBe("open")
        expect(Array.isArray(survey.questions_json)).toBe(true)
      }
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/surveys", token: null })

    expect(response.status).toBe(401)
  })
})
