import { describe, expect, test } from "bun:test"
import { seedCareerApplications } from "@/contexts/career/infrastructure/seed/seed-career-applications"
import { seedCareerPostings } from "@/contexts/career/infrastructure/seed/seed-career-postings"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const careerPostingResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  dept_id: z.number().nullable(),
  dept_name: z.string().nullable(),
  required_skills: z.string().nullable(),
  status: z.enum(["open", "closed"]),
})

const jwtSecret = "career-postings-crud-route-test-secret"

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

  return db
}

/** 公募 + 応募セットを含むDBを生成する。posting_id=1 に status=applied の応募あり。 */
async function createTestDbWithApplications(): Promise<D1Database> {
  const db = await createTestDb()

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

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: role,
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

describe("POST /career-postings", () => {
  test("admin creates a posting and returns 201", async () => {
    const response = await request({
      path: "/career-postings",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { title: "Backend Engineer", dept_id: 3, dept_name: "Engineering" },
    })

    expect(response.status).toBe(201)

    const parsed = careerPostingResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("Backend Engineer")
      expect(parsed.data.status).toBe("open")
    }
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/career-postings",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { title: "X" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 400 when title is missing", async () => {
    const response = await request({
      path: "/career-postings",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { dept_name: "Engineering" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when dept_id is zero", async () => {
    const response = await request({
      path: "/career-postings",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { title: "Invalid Dept", dept_id: 0 },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when dept_id is negative", async () => {
    const response = await request({
      path: "/career-postings",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { title: "Invalid Dept", dept_id: -1 },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/career-postings",
      token: null,
      method: "POST",
      body: { title: "X" },
    })

    expect(response.status).toBe(401)
  })
})

describe("GET /career-postings/:postingId", () => {
  test("admin reads a posting and returns 200", async () => {
    const response = await request({
      path: "/career-postings/1",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = careerPostingResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.title).toBe("プロダクト開発リード")
    }
  })

  test("reads a closed posting too (admin scope, not the public list)", async () => {
    const response = await request({
      path: "/career-postings/3",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)
  })

  test("member can read a posting to apply", async () => {
    const response = await request({
      path: "/career-postings/1",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)
  })

  test("returns 404 when the posting does not exist", async () => {
    const response = await request({
      path: "/career-postings/9999",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/career-postings/1",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("PUT /career-postings/:postingId", () => {
  test("admin updates a posting and returns 200", async () => {
    const response = await request({
      path: "/career-postings/1",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: {
        title: "Updated Lead",
        dept_id: 4,
        dept_name: "Platform",
        required_skills: "go",
        status: "closed",
      },
    })

    expect(response.status).toBe(200)

    const parsed = careerPostingResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("Updated Lead")
      expect(parsed.data.status).toBe("closed")
    }
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/career-postings/1",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { title: "X" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 when the posting does not exist", async () => {
    const response = await request({
      path: "/career-postings/9999",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { title: "X" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when dept_id is zero", async () => {
    const response = await request({
      path: "/career-postings/1",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { title: "Updated Lead", dept_id: 0 },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when dept_id is negative", async () => {
    const response = await request({
      path: "/career-postings/1",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { title: "Updated Lead", dept_id: -5 },
    })

    expect(response.status).toBe(400)
  })
})

describe("DELETE /career-postings/:postingId", () => {
  test("admin deletes a posting and returns 204", async () => {
    const response = await request({
      path: "/career-postings/2",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/career-postings/1",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 when the posting does not exist", async () => {
    const response = await request({
      path: "/career-postings/9999",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when the posting has applied applications", async () => {
    // posting_id=1 has a status=applied application in the seed
    const response = await requestWithContext({
      db: await createTestDbWithApplications(),
      jwtSecret,
      path: "/career-postings/1",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })
})
