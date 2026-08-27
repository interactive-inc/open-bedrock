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

const jwtSecret = "training-enrollments-route-test-secret"

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

describe("GET /training-enrollments", () => {
  test("a privileged role views another's status by employee_code", async () => {
    const response = await request("/training-enrollments?employee_code=E005", await tokenFor(1))

    expect(response.status).toBe(200)

    const body = z
      .object({ data: z.array(trainingEnrollmentResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(body.data.length).toBe(1)
    expect(body.data[0]?.employee_id).toBe(toWorkforceEmployeeId(5))
  })

  test("a member targeting another employee is forbidden", async () => {
    const response = await request("/training-enrollments?employee_code=E004", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown employee_code", async () => {
    const response = await request("/training-enrollments?employee_code=E999", await tokenFor(1))

    expect(response.status).toBe(404)
  })

  test("returns 404 for an unknown employee_id", async () => {
    const response = await request("/training-enrollments?employee_id=9999", await tokenFor(1))

    expect(response.status).toBe(404)
  })

  test("a privileged role views another's status by employee_id", async () => {
    const response = await request("/training-enrollments?employee_id=5", await tokenFor(1))

    expect(response.status).toBe(200)

    const body = z
      .object({ data: z.array(trainingEnrollmentResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(body.data.length).toBe(1)
    expect(body.data[0]?.employee_id).toBe(toWorkforceEmployeeId(5))
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/training-enrollments", null)

    expect(response.status).toBe(401)
  })
})
