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

describe("POST /training-courses", () => {
  test("privileged role creates a course and returns 201", async () => {
    const response = await request("/training-courses", await tokenFor(1, "root"), {
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
    const response = await request("/training-courses", await tokenFor(5, "member"), {
      method: "POST",
      body: { code: "TR-NEW-02", title: "X", category: "skill" },
    })

    expect(response.status).toBe(403)
  })

  test("duplicate code returns 409", async () => {
    const response = await request("/training-courses", await tokenFor(1, "root"), {
      method: "POST",
      body: { code: "TR-SEC-01", title: "Duplicate", category: "compliance" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 400 when a required field is missing", async () => {
    const response = await request("/training-courses", await tokenFor(1, "root"), {
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
