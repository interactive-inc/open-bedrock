import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedTrainingCourses } from "@/infrastructure/seed/seed-training-courses"
import { seedTrainingEnrollments } from "@/infrastructure/seed/seed-training-enrollments"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
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

const jwtSecret = "training-enroll-route-test-secret"

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

describe("POST /training/enrollments", () => {
  test("a member enrolls themselves and returns 201", async () => {
    const response = await request("/training/enrollments", await tokenFor(9, "member"), {
      method: "POST",
      body: { course_code: "TR-SEC-01" },
    })

    expect(response.status).toBe(201)

    const parsed = trainingEnrollmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(9)
      expect(parsed.data.status).toBe("enrolled")
    }
  })

  test("returns 409 for a duplicate enrollment", async () => {
    const response = await request("/training/enrollments", await tokenFor(5, "member"), {
      method: "POST",
      body: { course_code: "TR-SEC-01" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when the course is archived", async () => {
    const response = await request("/training/enrollments", await tokenFor(5, "member"), {
      method: "POST",
      body: { course_code: "TR-OLD-01" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown course_code", async () => {
    const response = await request("/training/enrollments", await tokenFor(5, "member"), {
      method: "POST",
      body: { course_code: "TR-NONE" },
    })

    expect(response.status).toBe(404)
  })

  test("a privileged role assigns to another employee_code", async () => {
    const response = await request("/training/enrollments", await tokenFor(1, "root"), {
      method: "POST",
      body: { course_code: "TR-MGR-01", employee_code: "E005" },
    })

    expect(response.status).toBe(201)

    const body = trainingEnrollmentResponseSchema.parse(await response.json())

    expect(body.employee_id).toBe(5)
  })

  test("a member assigning another employee is forbidden", async () => {
    const response = await request("/training/enrollments", await tokenFor(5, "member"), {
      method: "POST",
      body: { course_code: "TR-MGR-01", employee_code: "E009" },
    })

    expect(response.status).toBe(403)
  })

  test("assigning an unknown employee_code returns 404", async () => {
    const response = await request("/training/enrollments", await tokenFor(1, "root"), {
      method: "POST",
      body: { course_code: "TR-MGR-01", employee_code: "E999" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when course_code is missing", async () => {
    const response = await request("/training/enrollments", await tokenFor(5, "member"), {
      method: "POST",
      body: {},
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/training/enrollments", null, {
      method: "POST",
      body: { course_code: "TR-SEC-01" },
    })

    expect(response.status).toBe(401)
  })
})
