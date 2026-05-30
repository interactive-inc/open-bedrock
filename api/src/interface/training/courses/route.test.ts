import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedTrainingCourses } from "@/infrastructure/seed/seed-training-courses"
import { seedTrainingEnrollments } from "@/infrastructure/seed/seed-training-enrollments"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

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

const jwtSecret = "training-courses-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

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

describe("GET /training/courses", () => {
  test("returns 200 with all courses", async () => {
    const response = await request("/training/courses", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = z.array(trainingCourseResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(3)
    }
  })

  test("filters by category", async () => {
    const response = await request(
      "/training/courses?category=compliance",
      await tokenFor(5, "member"),
    )

    const body = z.array(trainingCourseResponseSchema).parse(await response.json())

    expect(body.length).toBe(1)
    expect(body[0]?.code).toBe("TR-SEC-01")
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/training/courses", null)

    expect(response.status).toBe(401)
  })
})
