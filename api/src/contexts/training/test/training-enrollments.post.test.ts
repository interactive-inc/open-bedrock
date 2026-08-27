import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
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

const trainingEnrollmentResponseSchema = z.object({
  id: z.number(),
  course_id: z.number(),
  employee_id: zEmployeeId,
  status: z.enum(["enrolled", "completed", "failed"]),
  completed_at: z.string().nullable(),
  score: z.number().nullable(),
  due_date: z.string().nullable(),
})

const jwtSecret = "training-enroll-route-test-secret"

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

describe("POST /training-enrollments", () => {
  test("a member enrolls themselves and returns 201", async () => {
    const response = await request("/training/training-enrollments", await tokenFor(9), {
      method: "POST",
      body: { course_code: "TR-SEC-01" },
    })

    expect(response.status).toBe(201)

    const parsed = trainingEnrollmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(toWorkforceEmployeeId(9))
      expect(parsed.data.status).toBe("enrolled")
    }
  })

  test("returns 409 for a duplicate enrollment", async () => {
    const response = await request("/training/training-enrollments", await tokenFor(5), {
      method: "POST",
      body: { course_code: "TR-SEC-01" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when the course is archived", async () => {
    const response = await request("/training/training-enrollments", await tokenFor(5), {
      method: "POST",
      body: { course_code: "TR-OLD-01" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown course_code", async () => {
    const response = await request("/training/training-enrollments", await tokenFor(5), {
      method: "POST",
      body: { course_code: "TR-NONE" },
    })

    expect(response.status).toBe(404)
  })

  test("a privileged role assigns to another employee_code", async () => {
    const response = await request("/training/training-enrollments", await tokenFor(1), {
      method: "POST",
      body: { course_code: "TR-MGR-01", employee_code: "E005" },
    })

    expect(response.status).toBe(201)

    const body = trainingEnrollmentResponseSchema.parse(await response.json())

    expect(body.employee_id).toBe(toWorkforceEmployeeId(5))
  })

  test("a member assigning another employee is forbidden", async () => {
    const response = await request("/training/training-enrollments", await tokenFor(5), {
      method: "POST",
      body: { course_code: "TR-MGR-01", employee_code: "E009" },
    })

    expect(response.status).toBe(403)
  })

  test("assigning an unknown employee_code returns 404", async () => {
    const response = await request("/training/training-enrollments", await tokenFor(1), {
      method: "POST",
      body: { course_code: "TR-MGR-01", employee_code: "E999" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when course_code is missing", async () => {
    const response = await request("/training/training-enrollments", await tokenFor(5), {
      method: "POST",
      body: {},
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/training/training-enrollments", null, {
      method: "POST",
      body: { course_code: "TR-SEC-01" },
    })

    expect(response.status).toBe(401)
  })
})
