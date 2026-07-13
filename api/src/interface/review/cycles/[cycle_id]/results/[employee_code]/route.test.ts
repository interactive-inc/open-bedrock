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

const jwtSecret = "review-cycles-results-route-test-secret"

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

const reviewResultResponseSchema = z.object({
  cycle_id: z.number(),
  subject_employee_id: z.number(),
  form_count: z.number(),
  submitted_count: z.number(),
  average_score: z.number().nullable(),
  forms: z.array(reviewFormResponseSchema).readonly(),
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
      status: form.status,
      submitted_at: form.submittedAt,
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

function memberToken(employeeId = 5): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
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

describe("GET /review-cycles/:cycle_id/results/:employee_code", () => {
  test("admin reads aggregated results and returns 200", async () => {
    const response = await request("/review-cycles/2/results/E005", await adminToken())

    expect(response.status).toBe(200)

    const parsed = reviewResultResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.cycle_id).toBe(2)
      expect(parsed.data.subject_employee_id).toBe(5)
      expect(parsed.data.form_count).toBe(1)
      expect(parsed.data.submitted_count).toBe(1)
      expect(parsed.data.average_score).toBe(80)
    }
  })

  test("member can read own results after the cycle is closed", async () => {
    const response = await request("/review-cycles/2/results/E005", await memberToken())

    expect(response.status).toBe(200)
  })

  test("unrelated member cannot read another employee results", async () => {
    const response = await request("/review-cycles/2/results/E005", await memberToken(6))

    expect(response.status).toBe(403)
  })

  test("returns 404 when the employee code is unknown", async () => {
    const response = await request("/review-cycles/2/results/E999", await adminToken())

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/review-cycles/2/results/E005", null)

    expect(response.status).toBe(401)
  })
})
