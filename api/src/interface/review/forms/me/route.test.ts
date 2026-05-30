import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedReviewCycles } from "@/infrastructure/seed/seed-review-cycles"
import { seedReviewForms } from "@/infrastructure/seed/seed-review-forms"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const jwtSecret = "review-forms-me-route-test-secret"

const reviewFormResponseSchema = z.object({
  id: z.number(),
  cycle_id: z.number(),
  subject_employee_id: z.number(),
  reviewer_employee_id: z.number(),
  reviewer_type: z.enum(["self", "manager", "peer", "subordinate"]),
  answers: z.array(z.unknown()).readonly(),
  score: z.number().nullable(),
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
      status: form.status,
      submitted_at: form.submittedAt,
    })),
  )

  return db
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

describe("GET /review-forms/me", () => {
  test("returns only the caller's forms", async () => {
    const response = await request("/review-forms/me", await managerToken())

    expect(response.status).toBe(200)

    const parsed = z.array(reviewFormResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(2)
      expect(parsed.data.every((form) => form.reviewer_employee_id === 4)).toBe(true)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/review-forms/me", null)

    expect(response.status).toBe(401)
  })
})
