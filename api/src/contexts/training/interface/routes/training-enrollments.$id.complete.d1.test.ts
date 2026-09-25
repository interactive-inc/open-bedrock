import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedTrainingCourses } from "@/contexts/training/test/seed/seed-training-courses.test-support"
import { seedTrainingEnrollments } from "@/contexts/training/test/seed/seed-training-enrollments.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(8)
})

afterAll(async () => {
  await pool.dispose()
})

const trainingEnrollmentResponseSchema = z.object({
  id: z.uuid(),
  course_id: z.uuid(),
  employee_id: zEmployeeId,
  status: z.enum(["enrolled", "completed", "failed"]),
  completed_at: z.string().nullable(),
  score: z.number().nullable(),
  due_date: z.string().nullable(),
})

const jwtSecret = "training-enrollment-complete-route-test-secret"

const fixedNow = "2026-01-01T00:00:00.000Z"

async function createTestDb(): Promise<D1Database> {
  const db = await pool.next()

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

describe("POST /training-enrollments/:id/complete", () => {
  test("the owner completes their enrollment and returns 200", async () => {
    const response = await request(
      "/training/training-enrollments/0190002d-0000-7000-8000-000000000001/complete",
      await tokenFor(5),
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
        "/training/training-enrollments/0190002d-0000-7000-8000-000000000001/complete",
        await tokenFor(5),
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
      "/training/training-enrollments/0190002d-0000-7000-8000-0000000003e7/complete",
      await tokenFor(5),
      {
        method: "POST",
        body: {},
      },
    )

    expect(response.status).toBe(404)
  })

  test("a member completing another's enrollment is forbidden", async () => {
    const response = await request(
      "/training/training-enrollments/0190002d-0000-7000-8000-000000000002/complete",
      await tokenFor(5),
      {
        method: "POST",
        body: {},
      },
    )

    expect(response.status).toBe(403)
  })

  test("returns 409 when already completed", async () => {
    const response = await request(
      "/training/training-enrollments/0190002d-0000-7000-8000-000000000002/complete",
      await tokenFor(4),
      {
        method: "POST",
        body: {},
      },
    )

    expect(response.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request(
      "/training/training-enrollments/0190002d-0000-7000-8000-000000000001/complete",
      null,
      {
        method: "POST",
        body: {},
      },
    )

    expect(response.status).toBe(401)
  })
})
