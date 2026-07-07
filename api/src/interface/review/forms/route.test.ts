import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedReviewCycles } from "@/infrastructure/seed/seed-review-cycles"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"

const jwtSecret = "review-subject-forms-route-test-secret"

// 被評価者 E005 のフォームを、1 件 disclosed / 1 件 hidden で投入する。
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
    {
      id: 1,
      cycle_id: 1,
      subject_employee_id: 5,
      reviewer_employee_id: 5,
      reviewer_type: "self",
      answers: "[]",
      score: 70,
      status: "submitted",
      submitted_at: "2026-06-01T00:00:00.000Z",
      visibility: "disclosed",
    },
    {
      id: 2,
      cycle_id: 1,
      subject_employee_id: 5,
      reviewer_employee_id: 4,
      reviewer_type: "manager",
      answers: "[]",
      score: 90,
      status: "submitted",
      submitted_at: "2026-06-01T00:00:00.000Z",
      visibility: "hidden",
    },
  ])

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
  })
}

// E005 本人。
function subjectToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

// E006 別の一般社員。
function otherToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 6,
    email: "you+e006@example.com",
    role: "member",
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /review-forms?subject_employee_id=", () => {
  test("admin sees all forms including hidden ones", async () => {
    const response = await request("/review-forms?subject_employee_id=5", await adminToken())

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.form_count).toBe(2)
    expect(body.reviewer_type_summary.length).toBe(2)
  })

  test("subject only sees disclosed forms", async () => {
    const response = await request("/review-forms?subject_employee_id=5", await subjectToken())

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.form_count).toBe(1)
    expect(body.forms[0].visibility).toBe("disclosed")
    expect(body.forms[0].reviewer_type).toBe("self")
  })

  test("another employee is forbidden", async () => {
    const response = await request("/review-forms?subject_employee_id=5", await otherToken())

    expect(response.status).toBe(403)
  })

  test("returns 400 without subject_employee_id", async () => {
    const response = await request("/review-forms", await adminToken())

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/review-forms?subject_employee_id=5", null)

    expect(response.status).toBe(401)
  })
})
