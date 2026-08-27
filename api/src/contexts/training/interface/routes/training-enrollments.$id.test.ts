import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/api/test/support/company/seed-employees.test-support"
import { seedTrainingCourses } from "@/contexts/training/test/seed/seed-training-courses.test-support"
import { seedTrainingEnrollments } from "@/contexts/training/test/seed/seed-training-enrollments.test-support"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@/api/test/support/initialize-standard-company-test-state"

const trainingEnrollmentResponseSchema = z.object({
  id: z.number(),
  course_id: z.number(),
  employee_id: z.number(),
  status: z.enum(["enrolled", "completed", "failed"]),
  completed_at: z.string().nullable(),
  score: z.number().nullable(),
  due_date: z.string().nullable(),
})

const jwtSecret = "training-enrollment-detail-route-test-secret"

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
    "training_courses",
    seedTrainingCourses.map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      duration_minutes: course.durationMinutes,
      category: course.category,
      is_required: course.isRequired ? 1 : 0,
      status: course.status,
    })),
  )

  await seedD1(
    db,
    "training_enrollments",
    seedTrainingEnrollments.map((enrollment) => ({
      id: enrollment.id,
      course_id: enrollment.courseId,
      employee_id: enrollment.employeeId,
      status: enrollment.status,
      completed_at: enrollment.completedAt,
      score: enrollment.score,
      due_date: enrollment.dueDate,
    })),
  )
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
  })
}

async function request(
  path: string,
  token: string | null,
  init?: { method: string; body: unknown },
): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path,
    token,
    method: init?.method,
    body: init?.body,
  })
}

describe("GET /training-enrollments/:id", () => {
  test("the owner reads their enrollment and returns 200", async () => {
    const response = await request("/training-enrollments/1", await tokenFor(5))

    expect(response.status).toBe(200)

    const body = trainingEnrollmentResponseSchema.parse(await response.json())

    expect(body.id).toBe(1)
    expect(body.employee_id).toBe(5)
  })

  test("a privileged role reads another's enrollment and returns 200", async () => {
    const response = await request("/training-enrollments/1", await tokenFor(1))

    expect(response.status).toBe(200)
  })

  test("a member reading another's enrollment is forbidden", async () => {
    const response = await request("/training-enrollments/2", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("returns 404 for a missing enrollment", async () => {
    const response = await request("/training-enrollments/999", await tokenFor(5))

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/training-enrollments/1", null)

    expect(response.status).toBe(401)
  })
})

describe("PUT /training-enrollments/:id", () => {
  test("the owner reschedules their enrollment and returns 200", async () => {
    const response = await request("/training-enrollments/1", await tokenFor(5), {
      method: "PUT",
      body: { due_date: "2026-09-30" },
    })

    expect(response.status).toBe(200)

    const body = trainingEnrollmentResponseSchema.parse(await response.json())

    expect(body.due_date).toBe("2026-09-30")
  })

  test("a member rescheduling another's enrollment is forbidden", async () => {
    const response = await request("/training-enrollments/2", await tokenFor(5), {
      method: "PUT",
      body: { due_date: "2026-09-30" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when the enrollment is already completed", async () => {
    const response = await request("/training-enrollments/2", await tokenFor(4), {
      method: "PUT",
      body: { due_date: "2026-09-30" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for a missing enrollment", async () => {
    const response = await request("/training-enrollments/999", await tokenFor(5), {
      method: "PUT",
      body: { due_date: null },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /training-enrollments/:id", () => {
  test("the owner cancels their enrollment and returns 204", async () => {
    const response = await request("/training-enrollments/1", await tokenFor(5), {
      method: "DELETE",
      body: {},
    })

    expect(response.status).toBe(204)
  })

  test("a member cancelling another's enrollment is forbidden", async () => {
    const response = await request("/training-enrollments/2", await tokenFor(5), {
      method: "DELETE",
      body: {},
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when cancelling a completed enrollment", async () => {
    const response = await request("/training-enrollments/2", await tokenFor(4), {
      method: "DELETE",
      body: {},
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for a missing enrollment", async () => {
    const response = await request("/training-enrollments/999", await tokenFor(5), {
      method: "DELETE",
      body: {},
    })

    expect(response.status).toBe(404)
  })
})
