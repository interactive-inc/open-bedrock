import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedReviewCycles } from "@/infrastructure/seed/seed-review-cycles"
import { seedReviewForms } from "@/infrastructure/seed/seed-review-forms"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "review-forms-submit-route-test-secret"

const fixedNow = "2026-01-01T00:00:00.000Z"

const reviewFormResponseSchema = z.object({
  id: z.number(),
  cycle_id: z.number(),
  subject_employee_id: z.number(),
  reviewer_employee_id: z.number(),
  reviewer_type: z.enum(["self", "manager", "peer", "subordinate"]),
  answers: z.array(z.unknown()).readonly(),
  score: z.number().nullable(),
  comment: z.string().nullable(),
  status: z.enum(["pending", "submitted"]),
  submitted_at: z.string().nullable(),
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
    "review_cycles",
    seedReviewCycles.map((cycle) => ({
      id: cycle.id,
      title: cycle.title,
      period: cycle.period,
      status: cycle.status,
      due_date: cycle.dueDate,
    })),
  )

  await seedD1(
    db,
    "review_forms",
    seedReviewForms.map((form) => ({
      id: form.id,
      cycle_id: form.cycleId,
      subject_employee_id: form.subjectEmployeeId,
      reviewer_employee_id: form.reviewerEmployeeId,
      reviewer_type: form.reviewerType,
      answers: JSON.stringify(form.answers),
      score: form.score,
      comment: form.comment,
      status: form.status,
      submitted_at: form.submittedAt,
    })),
  )

  return db
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

function managerToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 4,
    email: "you+e004@example.com",
    role: "member",
  })
}

async function request(
  path: string,
  token: string | null,
  method?: string,
  body?: unknown,
): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token, method, body })
}

describe("POST /review-forms/:form_id/submit", () => {
  test("the assigned reviewer submits an open-cycle form and returns 200", async () => {
    const response = await request("/review-forms/1/submit", await memberToken(), "POST", {
      score: 75,
      answers: ["on track"],
    })

    expect(response.status).toBe(200)

    const parsed = reviewFormResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("submitted")
      expect(parsed.data.score).toBe(75)
      expect(parsed.data.submitted_at).toBe(fixedNow)
    }
  })

  test("comment is saved and returned in the response", async () => {
    const response = await request("/review-forms/1/submit", await memberToken(), "POST", {
      score: 80,
      answers: ["good"],
      comment: "Excellent collaboration this quarter",
    })

    expect(response.status).toBe(200)

    const parsed = reviewFormResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.comment).toBe("Excellent collaboration this quarter")
      expect(parsed.data.status).toBe("submitted")
    }
  })

  test("comment defaults to null when omitted", async () => {
    const response = await request("/review-forms/1/submit", await memberToken(), "POST", {
      score: 75,
      answers: ["on track"],
    })

    expect(response.status).toBe(200)

    const parsed = reviewFormResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.comment).toBeNull()
    }
  })

  test("a non-assigned reviewer is forbidden", async () => {
    const response = await request("/review-forms/1/submit", await managerToken(), "POST", {
      score: 75,
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for a missing form", async () => {
    const response = await request("/review-forms/9999/submit", await memberToken(), "POST", {
      score: 75,
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when the cycle is not open", async () => {
    const response = await request("/review-forms/3/submit", await managerToken(), "POST", {
      score: 75,
    })

    expect(response.status).toBe(409)
  })

  test("rejects a negative score with 400", async () => {
    const response = await request("/review-forms/1/submit", await memberToken(), "POST", {
      score: -1,
    })

    expect(response.status).toBe(400)
  })

  test("rejects a score above 100 with 400", async () => {
    const response = await request("/review-forms/1/submit", await memberToken(), "POST", {
      score: 101,
    })

    expect(response.status).toBe(400)
  })

  test("rejects a non-integer score with 400", async () => {
    const response = await request("/review-forms/1/submit", await memberToken(), "POST", {
      score: 75.5,
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/review-forms/1/submit", null, "POST", { score: 75 })

    expect(response.status).toBe(401)
  })

  test("rejects answers exceeding the serialized size limit with 400", async () => {
    const response = await request("/review-forms/1/submit", await memberToken(), "POST", {
      score: 75,
      answers: ["x".repeat(20_000)],
    })

    expect(response.status).toBe(400)
  })

  test("accepts answers within the serialized size limit", async () => {
    const response = await request("/review-forms/1/submit", await memberToken(), "POST", {
      score: 75,
      answers: ["x".repeat(1_000)],
    })

    expect(response.status).toBe(200)
  })
})
