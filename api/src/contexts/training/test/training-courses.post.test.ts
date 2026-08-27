import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedTrainingCourses } from "@/contexts/training/test/seed/seed-training-courses.test-support"
import { seedTrainingEnrollments } from "@/contexts/training/test/seed/seed-training-enrollments.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const trainingCourseResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  duration_minutes: z.number().nullable(),
  category: z.string(),
  is_required: z.boolean(),
  status: z.enum(["active", "archived"]),
})

const jwtSecret = "training-course-create-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
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
    employeeId: toWorkforceEmployeeId(employeeId),
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

describe("POST /training-courses", () => {
  test("privileged role creates a course and returns 201", async () => {
    const response = await request("/training-courses", await tokenFor(1), {
      method: "POST",
      body: { code: "TR-NEW-01", title: "New Course", category: "skill" },
    })

    expect(response.status).toBe(201)

    const parsed = trainingCourseResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("active")
      expect(parsed.data.is_required).toBe(false)
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/training-courses", await tokenFor(5), {
      method: "POST",
      body: { code: "TR-NEW-02", title: "X", category: "skill" },
    })

    expect(response.status).toBe(403)
  })

  test("duplicate code returns 409", async () => {
    const response = await request("/training-courses", await tokenFor(1), {
      method: "POST",
      body: { code: "TR-SEC-01", title: "Duplicate", category: "compliance" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 400 when a required field is missing", async () => {
    const response = await request("/training-courses", await tokenFor(1), {
      method: "POST",
      body: { code: "TR-NEW-03", category: "skill" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/training-courses", null, {
      method: "POST",
      body: { code: "TR-NEW-04", title: "X", category: "skill" },
    })

    expect(response.status).toBe(401)
  })
})
