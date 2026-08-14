import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedTrainingCourses } from "@/contexts/company/infrastructure/seed/seed-training-courses"
import { seedTrainingEnrollments } from "@/contexts/company/infrastructure/seed/seed-training-enrollments"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const trainingEnrollmentResponseSchema = z.object({
  id: z.number(),
  course_id: z.number(),
  employee_id: z.number(),
  status: z.enum(["enrolled", "completed", "failed"]),
  completed_at: z.string().nullable(),
  score: z.number().nullable(),
  due_date: z.string().nullable(),
})

const jwtSecret = "training-enrollment-complete-route-test-secret"

const fixedNow = "2026-01-01T00:00:00.000Z"

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

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: role,
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

describe("POST /training-enrollments/:id/complete", () => {
  test("the owner completes their enrollment and returns 200", async () => {
    const response = await request(
      "/training-enrollments/1/complete",
      await tokenFor(5, "member"),
      {
        method: "POST",
        body: { score: 85 },
      },
    )

    expect(response.status).toBe(200)

    const body = trainingEnrollmentResponseSchema.parse(await response.json())

    expect(body.status).toBe("completed")
    expect(body.completed_at).toBe(fixedNow)
    expect(body.score).toBe(85)
  })

  test("rejects an out-of-range or non-integer score with 400", async () => {
    for (const score of [150, -5, 85.5]) {
      const response = await request(
        "/training-enrollments/1/complete",
        await tokenFor(5, "member"),
        {
          method: "POST",
          body: { score: score },
        },
      )

      expect(response.status).toBe(400)
    }
  })

  test("returns 404 for a missing enrollment", async () => {
    const response = await request(
      "/training-enrollments/999/complete",
      await tokenFor(5, "member"),
      { method: "POST", body: {} },
    )

    expect(response.status).toBe(404)
  })

  test("a member completing another's enrollment is forbidden", async () => {
    const response = await request(
      "/training-enrollments/2/complete",
      await tokenFor(5, "member"),
      {
        method: "POST",
        body: {},
      },
    )

    expect(response.status).toBe(403)
  })

  test("returns 409 when already completed", async () => {
    const response = await request(
      "/training-enrollments/2/complete",
      await tokenFor(4, "member"),
      {
        method: "POST",
        body: {},
      },
    )

    expect(response.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/training-enrollments/1/complete", null, {
      method: "POST",
      body: {},
    })

    expect(response.status).toBe(401)
  })
})
