import { describe, expect, test } from "bun:test"
import { seedCareerApplications } from "@/infrastructure/seed/seed-career-applications"
import { seedCareerPostings } from "@/infrastructure/seed/seed-career-postings"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const careerApplicationResponseSchema = z.object({
  id: z.number(),
  posting_id: z.number(),
  applicant_id: z.string(),
  message: z.string().nullable(),
  status: z.enum(["applied", "accepted", "rejected"]),
})

const jwtSecret = "career-applications-crud-test-secret"

// 応募 id 1: 応募者 6・status applied / 応募 id 2: 応募者 15・status accepted。
const appliedApplicationId = 1

const decidedApplicationId = 2

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

  return db
}

function tokenForEmployee(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: "member",
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

describe("GET /career/applications/me", () => {
  test("returns only the viewer's applications", async () => {
    const response = await request({
      path: "/career/applications/me",
      token: await tokenForEmployee(6),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(careerApplicationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0].applicant_id).toBe("6")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/career/applications/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /career/applications/:id", () => {
  test("returns the application for its applicant", async () => {
    const response = await request({
      path: `/career/applications/${appliedApplicationId}`,
      token: await tokenForEmployee(6),
    })

    expect(response.status).toBe(200)

    const parsed = careerApplicationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(appliedApplicationId)
    }
  })

  test("returns 403 for another person's application", async () => {
    const response = await request({
      path: `/career/applications/${appliedApplicationId}`,
      token: await tokenForEmployee(2),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown application", async () => {
    const response = await request({
      path: "/career/applications/9999",
      token: await tokenForEmployee(6),
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when the application id is not a positive integer", async () => {
    const response = await request({
      path: "/career/applications/abc",
      token: await tokenForEmployee(6),
    })

    expect(response.status).toBe(400)
  })
})

describe("PUT /career/applications/:id", () => {
  test("updates the message of the viewer's pending application", async () => {
    const response = await request({
      path: `/career/applications/${appliedApplicationId}`,
      token: await tokenForEmployee(6),
      method: "PUT",
      body: { message: "Updated motivation" },
    })

    expect(response.status).toBe(200)

    const parsed = careerApplicationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.message).toBe("Updated motivation")
    }
  })

  test("returns 403 when updating another person's application", async () => {
    const response = await request({
      path: `/career/applications/${appliedApplicationId}`,
      token: await tokenForEmployee(2),
      method: "PUT",
      body: { message: "Hijack" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when updating a decided application", async () => {
    const response = await request({
      path: `/career/applications/${decidedApplicationId}`,
      token: await tokenForEmployee(15),
      method: "PUT",
      body: { message: "Too late" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown application", async () => {
    const response = await request({
      path: "/career/applications/9999",
      token: await tokenForEmployee(6),
      method: "PUT",
      body: { message: "ghost" },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /career/applications/:id", () => {
  test("withdraws the viewer's pending application and returns 204", async () => {
    const response = await request({
      path: `/career/applications/${appliedApplicationId}`,
      token: await tokenForEmployee(6),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when withdrawing another person's application", async () => {
    const response = await request({
      path: `/career/applications/${appliedApplicationId}`,
      token: await tokenForEmployee(2),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when withdrawing a decided application", async () => {
    const response = await request({
      path: `/career/applications/${decidedApplicationId}`,
      token: await tokenForEmployee(15),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown application", async () => {
    const response = await request({
      path: "/career/applications/9999",
      token: await tokenForEmployee(6),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/career/applications/${appliedApplicationId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
