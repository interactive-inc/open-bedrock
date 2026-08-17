import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { seedReviewCycles } from "@/contexts/performance-review/infrastructure/seed/seed-review-cycles"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"

const jwtSecret = "review-forms-bulk-route-test-secret"

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

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "root",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
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

describe("POST /review-cycles/:cycle_id/forms/bulk", () => {
  test("admin creates self/manager/peer forms in one call and they start hidden", async () => {
    const response = await request("/review-cycles/1/forms/bulk", await adminToken(), "POST", {
      forms: [
        { subject_employee_id: 5, reviewer_employee_id: 5, reviewer_type: "self" },
        { subject_employee_id: 5, reviewer_employee_id: 4, reviewer_type: "manager" },
        { subject_employee_id: 5, reviewer_employee_id: 2, reviewer_type: "peer" },
      ],
    })

    expect(response.status).toBe(201)

    const parsed = z
      .object({
        created_count: z.number(),
        forms: z.array(
          z.object({ visibility: z.string(), status: z.string(), cycle_id: z.number() }),
        ),
      })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.created_count).toBe(3)
      expect(parsed.data.forms.length).toBe(3)

      for (const form of parsed.data.forms) {
        expect(form.visibility).toBe("hidden")
        expect(form.status).toBe("pending")
        expect(form.cycle_id).toBe(1)
      }
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/review-cycles/1/forms/bulk", await memberToken(), "POST", {
      forms: [{ subject_employee_id: 5, reviewer_employee_id: 5, reviewer_type: "self" }],
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 when the cycle does not exist", async () => {
    const response = await request("/review-cycles/999/forms/bulk", await adminToken(), "POST", {
      forms: [{ subject_employee_id: 5, reviewer_employee_id: 5, reviewer_type: "self" }],
    })

    expect(response.status).toBe(404)
  })

  test("returns 404 when a referenced employee does not exist", async () => {
    const response = await request("/review-cycles/1/forms/bulk", await adminToken(), "POST", {
      forms: [{ subject_employee_id: 5, reviewer_employee_id: 9999, reviewer_type: "peer" }],
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/review-cycles/1/forms/bulk", null, "POST", { forms: [] })

    expect(response.status).toBe(401)
  })
})
