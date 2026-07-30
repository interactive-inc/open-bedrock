import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedReviewCycles } from "@/infrastructure/seed/seed-review-cycles"
import { seedReviewForms } from "@/infrastructure/seed/seed-review-forms"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
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

  await seedD1(db, "review_forms", [
    ...seedReviewForms.map((form) => ({
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
    {
      id: 4,
      cycle_id: 2,
      subject_employee_id: 5,
      reviewer_employee_id: 10,
      reviewer_type: "peer",
      answers: JSON.stringify(["Private peer answer"]),
      score: 70,
      status: "submitted",
      submitted_at: "2025-12-21T00:00:00Z",
    },
    {
      id: 5,
      cycle_id: 2,
      subject_employee_id: 5,
      reviewer_employee_id: 9,
      reviewer_type: "subordinate",
      answers: JSON.stringify(["Private subordinate answer"]),
      score: 90,
      status: "submitted",
      submitted_at: "2025-12-22T00:00:00Z",
    },
    {
      id: 6,
      cycle_id: 2,
      subject_employee_id: 5,
      reviewer_employee_id: 2,
      reviewer_type: "peer",
      answers: "[]",
      score: null,
      status: "pending",
      submitted_at: null,
    },
  ])

  // E004 was the saved reviewer. The current reporting line has since changed to E006.
  await seedD1(db, "org_memberships", [
    { department_code: "D003", employee_code: "E004", manager_employee_code: "E001" },
    { department_code: "D003", employee_code: "E005", manager_employee_code: "E006" },
    { department_code: "D003", employee_code: "E006", manager_employee_code: "E001" },
  ])

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "root",
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
      expect(parsed.data.form_count).toBe(4)
      expect(parsed.data.submitted_count).toBe(3)
      expect(parsed.data.average_score).toBe(80)
      expect(parsed.data.forms.map((form) => form.id)).toEqual([3, 4, 5, 6])
    }
  })

  test("member can read own results after the cycle is closed", async () => {
    const response = await request("/review-cycles/2/results/E005", await memberToken())

    expect(response.status).toBe(200)

    const parsed = reviewResultResponseSchema.parse(await response.json())
    expect(parsed.form_count).toBe(4)
    expect(parsed.forms.map((form) => form.id)).toEqual([3, 4, 5, 6])
  })

  test("saved reviewer receives only their own submitted form after the reporting line changes", async () => {
    const response = await request("/review-cycles/2/results/E005", await memberToken(4))

    expect(response.status).toBe(200)

    const parsed = reviewResultResponseSchema.parse(await response.json())
    expect(parsed).toMatchObject({
      form_count: 1,
      submitted_count: 1,
      average_score: 80,
      forms: [
        {
          id: 3,
          reviewer_employee_id: 4,
          answers: ["優れた協調性"],
          score: 80,
        },
      ],
    })
    expect(JSON.stringify(parsed)).not.toContain("Private peer answer")
    expect(JSON.stringify(parsed)).not.toContain("Private subordinate answer")
  })

  test("saved peer reviewer cannot see another saved reviewer's form or aggregate", async () => {
    const response = await request("/review-cycles/2/results/E005", await memberToken(10))

    expect(response.status).toBe(200)

    const parsed = reviewResultResponseSchema.parse(await response.json())
    expect(parsed.form_count).toBe(1)
    expect(parsed.submitted_count).toBe(1)
    expect(parsed.average_score).toBe(70)
    expect(parsed.forms).toHaveLength(1)
    expect(parsed.forms[0]).toMatchObject({
      id: 4,
      reviewer_employee_id: 10,
      answers: ["Private peer answer"],
    })
  })

  test("saved reviewer with no submitted form cannot read the result", async () => {
    const response = await request("/review-cycles/2/results/E005", await memberToken(2))

    expect(response.status).toBe(403)
  })

  test("new current manager cannot read historical results they did not review", async () => {
    const response = await request("/review-cycles/2/results/E005", await memberToken(6))

    expect(response.status).toBe(403)
  })

  test("unrelated member cannot read another employee results", async () => {
    const response = await request("/review-cycles/2/results/E005", await memberToken(3))

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
