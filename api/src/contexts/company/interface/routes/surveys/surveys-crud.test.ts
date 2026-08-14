import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedSurveyResponses } from "@/contexts/company/infrastructure/seed/seed-survey-responses"
import { seedSurveys } from "@/contexts/company/infrastructure/seed/seed-surveys"
import { databaseMiddleware } from "@/contexts/company/interface/middlewares/database-middleware"
import { HTTPException } from "hono/http-exception"
import { contextStorage } from "hono/context-storage"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import * as surveyCreateRoute from "@/contexts/company/interface/routes/surveys/create-route"
import * as surveyDetailRoute from "@/contexts/company/interface/routes/surveys/[survey_id]/route"
import * as surveyResponseCreateRoute from "@/contexts/company/interface/routes/surveys/[survey_id]/responses/route"
import * as surveySummaryRoute from "@/contexts/company/interface/routes/surveys/[survey_id]/summary/route"
import type { Bindings } from "@/env"
import { factory } from "@/contexts/company/interface/utils/factory"
import { z } from "zod"

const surveyResponseSchema = z.object({
  id: z.number().nullable(),
  title: z.string(),
  status: z.enum(["open", "closed"]),
  questions_json: z.array(z.unknown()),
})

const jwtSecret = "survey-surveys-crud-test-secret"

/**
 * app.ts は共有のため編集できない。本テスト用に同じミドルウェア構成の隔離 app を組む。
 * 固有パス（responses/summary）を :survey_id より前に登録し、衝突しないことも確かめる。
 */
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
  .get("/surveys/:survey_id/summary", ...surveySummaryRoute.GET)
  .post("/surveys/:survey_id/responses", ...surveyResponseCreateRoute.POST)
  .post("/surveys", ...surveyCreateRoute.POST)
  .put("/surveys/:survey_id", ...surveyDetailRoute.PUT)
  .delete("/surveys/:survey_id", ...surveyDetailRoute.DELETE)

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

/** 管理権限ロール。 */
function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "root",
  })
}

/** 一般ロール（管理権限なし）。 */
function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 13,
    email: "you+e013@example.com",
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
    AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
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

describe("POST /surveys", () => {
  test("creates a survey and returns 201 with a generated id", async () => {
    const response = await request({
      path: "/surveys",
      token: await adminToken(),
      method: "POST",
      body: {
        title: "New Onboarding Survey",
        status: "open",
        questions_json: [{ id: "q1", type: "text", text: "How was your first week?" }],
      },
    })

    expect(response.status).toBe(201)

    const parsed = surveyResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).not.toBeNull()
      expect(parsed.data.title).toBe("New Onboarding Survey")
      expect(parsed.data.questions_json.length).toBe(1)
    }
  })

  test("returns 403 for a non-admin", async () => {
    const response = await request({
      path: "/surveys",
      token: await memberToken(),
      method: "POST",
      body: { title: "X", status: "open", questions_json: [] },
    })

    expect(response.status).toBe(403)
  })

  test("returns 400 when title is missing", async () => {
    const response = await request({
      path: "/surveys",
      token: await adminToken(),
      method: "POST",
      body: { status: "open", questions_json: [] },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/surveys",
      token: null,
      method: "POST",
      body: { title: "X", status: "open", questions_json: [] },
    })

    expect(response.status).toBe(401)
  })
})

describe("PUT /surveys/:survey_id", () => {
  test("updates a survey without responses and returns 200", async () => {
    const response = await request({
      path: "/surveys/2",
      token: await adminToken(),
      method: "PUT",
      body: {
        title: "Updated Remote Work Survey",
        status: "closed",
        questions_json: [{ id: "q1", type: "scale", text: "Updated", min: 1, max: 5 }],
      },
    })

    expect(response.status).toBe(200)

    const parsed = surveyResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(2)
      expect(parsed.data.title).toBe("Updated Remote Work Survey")
      expect(parsed.data.status).toBe("closed")
    }
  })

  test("returns 409 when changing questions on a survey with responses", async () => {
    const response = await request({
      path: "/surveys/1",
      token: await adminToken(),
      method: "PUT",
      body: {
        title: "Updated Engagement Survey",
        status: "open",
        questions_json: [{ id: "q1", type: "scale", text: "Changed question" }],
      },
    })

    expect(response.status).toBe(409)
  })

  test("allows changing questions on a survey without responses", async () => {
    const response = await request({
      path: "/surveys/2",
      token: await adminToken(),
      method: "PUT",
      body: {
        title: "Updated Remote Work Survey",
        status: "open",
        questions_json: [{ id: "q1", type: "text", text: "New question" }],
      },
    })

    expect(response.status).toBe(200)
  })

  test("returns 403 for a non-admin", async () => {
    const response = await request({
      path: "/surveys/1",
      token: await memberToken(),
      method: "PUT",
      body: { title: "X", status: "open", questions_json: [] },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown survey", async () => {
    const response = await request({
      path: "/surveys/9999",
      token: await adminToken(),
      method: "PUT",
      body: { title: "X", status: "open", questions_json: [] },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when status is invalid", async () => {
    const response = await request({
      path: "/surveys/1",
      token: await adminToken(),
      method: "PUT",
      body: { title: "X", status: "paused", questions_json: [] },
    })

    expect(response.status).toBe(400)
  })

  // #910: closed → open の再開は禁止し、409 を返す。
  test("returns 409 when reopening a closed survey", async () => {
    const response = await request({
      path: "/surveys/3",
      token: await adminToken(),
      method: "PUT",
      body: {
        title: "H2 FY2025 Retrospective Survey",
        status: "open",
        questions_json: [{ id: "q1", type: "scale", text: "I achieved my goals", min: 1, max: 5 }],
      },
    })

    expect(response.status).toBe(409)
  })
})

describe("DELETE /surveys/:survey_id", () => {
  test("deletes a closed survey and returns 204", async () => {
    const response = await request({
      path: "/surveys/3",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 409 when deleting an open survey", async () => {
    const response = await request({
      path: "/surveys/1",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("returns 403 for a non-admin", async () => {
    const response = await request({
      path: "/surveys/1",
      token: await memberToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown survey", async () => {
    const response = await request({
      path: "/surveys/9999",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/surveys/1",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })

  test("deletes related survey_responses before the survey", async () => {
    const db = await createTestDb()
    const token = await adminToken()

    const bindings: Bindings = {
      DB: db,
      JWT_SECRET: jwtSecret,
      AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
      NOW: "2026-01-01T00:00:00.000Z",
    }

    // Close survey 1 directly so the deletion guard allows it.
    await db.prepare("UPDATE surveys SET status = 'closed' WHERE id = 1").run()

    // Survey 1 has 3 seed responses. Confirm they exist via summary.
    const summaryBefore = await testApp.request(
      "/surveys/1/summary",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      bindings,
    )

    expect(summaryBefore.status).toBe(200)

    const bodyBefore = z.object({ response_count: z.number() }).parse(await summaryBefore.json())

    expect(bodyBefore.response_count).toBe(3)

    // Delete the now-closed survey.
    const deleteRes = await testApp.request(
      "/surveys/1",
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      bindings,
    )

    expect(deleteRes.status).toBe(204)

    // Summary should now 404 because the survey is gone.
    const summaryAfter = await testApp.request(
      "/surveys/1/summary",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      bindings,
    )

    expect(summaryAfter.status).toBe(404)
  })
})
