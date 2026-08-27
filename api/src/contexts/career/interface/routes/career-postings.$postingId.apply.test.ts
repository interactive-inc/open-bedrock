import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedCareerApplications } from "@/contexts/career/test/seed/seed-career-applications.test-support"
import { seedCareerPostings } from "@/contexts/career/test/seed/seed-career-postings.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const careerApplicationResponseSchema = z.object({
  id: z.number(),
  posting_id: z.number(),
  applicant_id: zEmployeeId,
  message: z.string().nullable(),
  status: z.enum(["applied", "accepted", "rejected"]),
})

const jwtSecret = "career-postings-apply-route-test-secret"

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
    "career_postings",
    seedCareerPostings.map((posting) => ({
      id: posting.id,
      title: posting.title,
      dept_id: posting.deptId,
      dept_name: posting.deptName,
      required_skills: posting.requiredSkills,
      status: posting.status,
    })),
  )

  await seedD1(
    db,
    "career_applications",
    seedCareerApplications.map((application) => ({
      id: application.id,
      posting_id: application.postingId,
      applicant_id: application.applicantId,
      message: application.message,
      status: application.status,
    })),
  )
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenForEmployee(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

async function request(props: {
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("POST /career-postings/:postingId/apply", () => {
  test("returns 201 with the created application", async () => {
    const response = await request({
      path: "/career-postings/1/apply",
      token: await tokenForEmployee(2),
      method: "POST",
      body: { message: "I would like to apply" },
    })

    expect(response.status).toBe(201)

    const parsed = careerApplicationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.posting_id).toBe(1)
      expect(parsed.data.applicant_id).toBe(toWorkforceEmployeeId(2))
      expect(parsed.data.message).toBe("I would like to apply")
      expect(parsed.data.status).toBe("applied")
    }
  })

  test("returns 201 with a null message when omitted", async () => {
    const response = await request({
      path: "/career-postings/1/apply",
      token: await tokenForEmployee(2),
      method: "POST",
      body: { message: null },
    })

    expect(response.status).toBe(201)

    const parsed = careerApplicationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.message).toBe(null)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/career-postings/1/apply",
      token: null,
      method: "POST",
      body: { message: null },
    })

    expect(response.status).toBe(401)
  })

  test("returns 404 when the posting id is not a positive integer", async () => {
    const response = await request({
      path: "/career-postings/abc/apply",
      token: await tokenForEmployee(2),
      method: "POST",
      body: { message: null },
    })

    expect(response.status).toBe(404)
  })

  test("returns 404 when the posting does not exist", async () => {
    const response = await request({
      path: "/career-postings/9999/apply",
      token: await tokenForEmployee(2),
      method: "POST",
      body: { message: null },
    })

    expect(response.status).toBe(404)
  })

  test("returns 404 when the posting is closed", async () => {
    const response = await request({
      path: "/career-postings/3/apply",
      token: await tokenForEmployee(2),
      method: "POST",
      body: { message: null },
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when the applicant already applied", async () => {
    const response = await request({
      path: "/career-postings/1/apply",
      token: await tokenForEmployee(6),
      method: "POST",
      body: { message: "Duplicate application" },
    })

    expect(response.status).toBe(409)
  })
})
