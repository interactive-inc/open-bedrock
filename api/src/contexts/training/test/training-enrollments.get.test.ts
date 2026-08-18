import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { seedTrainingCourses } from "@/contexts/training/infrastructure/seed/seed-training-courses"
import { seedTrainingEnrollments } from "@/contexts/training/infrastructure/seed/seed-training-enrollments"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
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

const jwtSecret = "training-enrollments-route-test-secret"

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

describe("GET /training-enrollments", () => {
  test("a privileged role views another's status by employee_code", async () => {
    const response = await request(
      "/training-enrollments?employee_code=E005",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(200)

    const body = z
      .object({ data: z.array(trainingEnrollmentResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(body.data.length).toBe(1)
    expect(body.data[0]?.employee_id).toBe(5)
  })

  test("a member targeting another employee is forbidden", async () => {
    const response = await request(
      "/training-enrollments?employee_code=E004",
      await tokenFor(5, "member"),
    )

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown employee_code", async () => {
    const response = await request(
      "/training-enrollments?employee_code=E999",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(404)
  })

  test("returns 404 for an unknown employee_id", async () => {
    const response = await request(
      "/training-enrollments?employee_id=9999",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(404)
  })

  test("a privileged role views another's status by employee_id", async () => {
    const response = await request("/training-enrollments?employee_id=5", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const body = z
      .object({ data: z.array(trainingEnrollmentResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(body.data.length).toBe(1)
    expect(body.data[0]?.employee_id).toBe(5)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/training-enrollments", null)

    expect(response.status).toBe(401)
  })
})
