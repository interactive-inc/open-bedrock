import { describe, expect, test } from "bun:test"
import { seedSurveyResponses } from "@/infrastructure/seed/seed-survey-responses"
import { seedSurveys } from "@/infrastructure/seed/seed-surveys"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { databaseMiddleware } from "@/interface/shared/database-middleware"
import { HTTPException } from "hono/http-exception"
import { contextStorage } from "hono/context-storage"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import * as responseDetailRoute from "@/interface/survey/surveys/responses/[response_id]/route"
import * as responseMineRoute from "@/interface/survey/surveys/responses/me/route"
import type { Bindings } from "@/env"
import { factory } from "@/lib/factory"
import { z } from "zod"

const surveyResponseSchema = z.object({
  id: z.number(),
  survey_id: z.number(),
  respondent_id: z.number(),
  answers_json: z.unknown(),
  submitted_at: z.string(),
})

const jwtSecret = "survey-responses-crud-test-secret"

// app.ts は共有のため編集できない。本テスト用に同じミドルウェア構成の隔離 app を組む。
const testApp = factory
  .createApp()
  .use("*", contextStorage())
  .use("*", databaseMiddleware)
  .onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status)
    }

    return c.json({ error: "internal server error" }, 500)
  })
  .get("/surveys/responses/me", ...responseMineRoute.GET)
  .get("/surveys/responses/:response_id", ...responseDetailRoute.GET)
  .put("/surveys/responses/:response_id", ...responseDetailRoute.PUT)
  .delete("/surveys/responses/:response_id", ...responseDetailRoute.DELETE)

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

// 回答 id=1 (survey 1, open) の回答者本人。
function ownerToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

// 他人（回答 id=1 の回答者ではない）。
function otherToken(): Promise<string> {
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
  const headers: Record<string, string> = {}

  if (props.token !== null) {
    headers.Authorization = `Bearer ${props.token}`
  }

  if (props.body !== undefined) {
    headers["content-type"] = "application/json"
  }

  const bindings: Bindings = {
    DB: await createTestDb(),
    JWT_SECRET: jwtSecret,
    NOW: "2026-01-01T00:00:00.000Z",
  }

  return testApp.request(
    props.path,
    {
      method: props.method ?? "GET",
      headers,
      body: props.body === undefined ? undefined : JSON.stringify(props.body),
    },
    bindings,
  )
}

describe("GET /surveys/responses/me", () => {
  test("returns only the viewer's responses", async () => {
    const response = await request({ path: "/surveys/responses/me", token: await ownerToken() })

    expect(response.status).toBe(200)

    const parsed = z.array(surveyResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
      expect(parsed.data[0].respondent_id).toBe(5)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/surveys/responses/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /surveys/responses/:response_id", () => {
  test("returns the response for its respondent", async () => {
    const response = await request({ path: "/surveys/responses/1", token: await ownerToken() })

    expect(response.status).toBe(200)

    const parsed = surveyResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
    }
  })

  test("returns 403 for another person's response", async () => {
    const response = await request({ path: "/surveys/responses/1", token: await otherToken() })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown response", async () => {
    const response = await request({ path: "/surveys/responses/9999", token: await ownerToken() })

    expect(response.status).toBe(404)
  })
})

describe("PUT /surveys/responses/:response_id", () => {
  test("updates the answers of the viewer's response while the survey is open", async () => {
    const response = await request({
      path: "/surveys/responses/1",
      token: await ownerToken(),
      method: "PUT",
      body: { answers_json: { q1: 2, q2: 3, q3: "Revised" } },
    })

    expect(response.status).toBe(200)

    const parsed = surveyResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.submitted_at).toBe("2026-01-01T00:00:00.000Z")
    }
  })

  test("returns 403 when updating another person's response", async () => {
    const response = await request({
      path: "/surveys/responses/1",
      token: await otherToken(),
      method: "PUT",
      body: { answers_json: { q1: 1 } },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown response", async () => {
    const response = await request({
      path: "/surveys/responses/9999",
      token: await ownerToken(),
      method: "PUT",
      body: { answers_json: { q1: 1 } },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when answers_json is missing", async () => {
    const response = await request({
      path: "/surveys/responses/1",
      token: await ownerToken(),
      method: "PUT",
      body: {},
    })

    expect(response.status).toBe(400)
  })
})

describe("DELETE /surveys/responses/:response_id", () => {
  test("withdraws the viewer's response and returns 204", async () => {
    const response = await request({
      path: "/surveys/responses/1",
      token: await ownerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when withdrawing another person's response", async () => {
    const response = await request({
      path: "/surveys/responses/1",
      token: await otherToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown response", async () => {
    const response = await request({
      path: "/surveys/responses/9999",
      token: await ownerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/surveys/responses/1",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
