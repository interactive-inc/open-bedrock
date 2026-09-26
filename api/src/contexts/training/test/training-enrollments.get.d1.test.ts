import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { testEmployeeId } from "@tests/api/support/test-identity-id"
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
  pool = await startLocalD1Pool(6)
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

const jwtSecret = "training-enrollments-route-test-secret"

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

describe("GET /training-enrollments", () => {
  test("a privileged role views another's status by employee_code", async () => {
    const response = await request(
      "/training/training-enrollments?employee_code=E005",
      await tokenFor(1),
    )

    expect(response.status).toBe(200)

    const body = z
      .object({ data: z.array(trainingEnrollmentResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(body.data.length).toBe(1)
    expect(body.data[0]?.employee_id).toBe(toWorkforceEmployeeId(testEmployeeId(5)))
  })

  test("a member targeting another employee is forbidden", async () => {
    const response = await request(
      "/training/training-enrollments?employee_code=E004",
      await tokenFor(5),
    )

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown employee_code", async () => {
    const response = await request(
      "/training/training-enrollments?employee_code=E999",
      await tokenFor(1),
    )

    expect(response.status).toBe(404)
  })

  test("returns 404 for an unknown employee_id", async () => {
    const response = await request(
      `/training/training-enrollments?employee_id=${testEmployeeId(9999)}`,
      await tokenFor(1),
    )

    expect(response.status).toBe(404)
  })

  test("a privileged role views another's status by employee_id", async () => {
    const response = await request(
      `/training/training-enrollments?employee_id=${testEmployeeId(5)}`,
      await tokenFor(1),
    )

    expect(response.status).toBe(200)

    const body = z
      .object({ data: z.array(trainingEnrollmentResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(body.data.length).toBe(1)
    expect(body.data[0]?.employee_id).toBe(toWorkforceEmployeeId(testEmployeeId(5)))
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/training/training-enrollments", null)

    expect(response.status).toBe(401)
  })
})
