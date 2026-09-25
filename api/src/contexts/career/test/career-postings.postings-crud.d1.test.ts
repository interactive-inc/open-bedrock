import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedCareerApplications } from "@/contexts/career/test/seed/seed-career-applications.test-support"
import { seedCareerPostings } from "@/contexts/career/test/seed/seed-career-postings.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
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
  pool = await startLocalD1Pool(22)
})

afterAll(async () => {
  await pool.dispose()
})

const careerPostingResponseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  organization_unit_id: z.string().nullable(),
  organization_unit_name: z.string().nullable(),
  legacy_dept_name: z.string().nullable(),
  required_skills: z.string().nullable(),
  status: z.enum(["open", "closed"]),
})

const jwtSecret = "career-postings-crud-route-test-secret"

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
  await initializeStandardCompanyTestState(db)

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

function tokenFor(employeeId: number): Promise<string> {
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

describe("POST /career-postings", () => {
  test("admin creates a posting and returns 201", async () => {
    const response = await request({
      path: "/career/career-postings",
      token: await tokenFor(1),
      method: "POST",
      body: { title: "Backend Engineer", organization_unit_id: "department:D003" },
    })

    expect(response.status).toBe(201)

    const parsed = careerPostingResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.title).toBe("Backend Engineer")
      expect(parsed.data.status).toBe("open")
      expect(parsed.data.organization_unit_id).toBe("department:D003")
      expect(parsed.data.organization_unit_name).toBe("開発部")
      expect(parsed.data.legacy_dept_name).toBeNull()
    }
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/career/career-postings",
      token: await tokenFor(5),
      method: "POST",
      body: { title: "X" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 400 when title is missing", async () => {
    const response = await request({
      path: "/career/career-postings",
      token: await tokenFor(1),
      method: "POST",
      body: { organization_unit_id: "department:D003" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when the retired numeric dept_id is sent", async () => {
    const response = await request({
      path: "/career/career-postings",
      token: await tokenFor(1),
      method: "POST",
      body: { title: "Invalid Dept", dept_id: 3 },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when organization_unit_id is malformed", async () => {
    const response = await request({
      path: "/career/career-postings",
      token: await tokenFor(1),
      method: "POST",
      body: { title: "Invalid Dept", organization_unit_id: "/bad id" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 422 when the organization unit does not exist", async () => {
    const response = await request({
      path: "/career/career-postings",
      token: await tokenFor(1),
      method: "POST",
      body: { title: "Invalid Dept", organization_unit_id: "department:D999" },
    })

    expect(response.status).toBe(422)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/career/career-postings",
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
      path: "/career/career-postings/01900017-0000-7000-8000-000000000001",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const parsed = careerPostingResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe("01900017-0000-7000-8000-000000000001")
      expect(parsed.data.title).toBe("プロダクト開発リード")
    }
  })

  test("reads a closed posting too (admin scope, not the public list)", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-000000000003",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)
  })

  test("member can read a posting to apply", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-000000000001",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(200)
  })

  test("returns 404 when the posting does not exist", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-00000000270f",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-000000000001",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("PUT /career-postings/:postingId", () => {
  test("admin updates a posting and returns 200", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-000000000001",
      token: await tokenFor(1),
      method: "PUT",
      body: {
        title: "Updated Lead",
        organization_unit_id: "department:D004",
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
      expect(parsed.data.organization_unit_id).toBe("department:D004")
      expect(parsed.data.organization_unit_name).toBe("営業部")
      expect(parsed.data.legacy_dept_name).toBe("開発部")
    }
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-000000000001",
      token: await tokenFor(5),
      method: "PUT",
      body: { title: "X" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 when the posting does not exist", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-00000000270f",
      token: await tokenFor(1),
      method: "PUT",
      body: { title: "X" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when the retired dept_name is sent", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-000000000001",
      token: await tokenFor(1),
      method: "PUT",
      body: { title: "Updated Lead", dept_name: "Platform" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 422 when moving to the company itself", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-000000000001",
      token: await tokenFor(1),
      method: "PUT",
      body: { title: "Updated Lead", organization_unit_id: "company:root" },
    })

    expect(response.status).toBe(422)
  })
})

describe("DELETE /career-postings/:postingId", () => {
  test("admin deletes a posting and returns 204", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-000000000002",
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-000000000001",
      token: await tokenFor(5),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 when the posting does not exist", async () => {
    const response = await request({
      path: "/career/career-postings/01900017-0000-7000-8000-00000000270f",
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when the posting has applied applications", async () => {
    // posting_id=1 has a status=applied application in the seed
    const response = await requestWithContext({
      db: await createTestDbWithApplications(),
      jwtSecret,
      path: "/career/career-postings/01900017-0000-7000-8000-000000000001",
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })
})

describe("organization unit picked from the Company organization units list", () => {
  test("stores the id listed by /company/organization-units for a newly created unit", async () => {
    const db = await createTestDb()
    const token = await tokenFor(1)

    const createdUnit = await requestWithContext({
      db,
      jwtSecret,
      path: "/company/organization-units",
      token,
      method: "POST",
      headers: { "Idempotency-Key": "career-posting-new-unit" },
      body: { code: "D100", name: "新設部", parent_code: null },
    })

    expect([200, 201]).toContain(createdUnit.status)

    const listed = await requestWithContext({
      db,
      jwtSecret,
      path: "/company/organization-units",
      token,
    })

    expect(listed.status).toBe(200)

    const units = z
      .array(z.object({ id: z.string(), code: z.string(), name: z.string() }))
      .parse(await listed.json())
    const unit = units.find((candidate) => candidate.code === "D100")

    if (unit === undefined) {
      throw new Error("new unit is not listed")
    }

    const created = await requestWithContext({
      db,
      jwtSecret,
      path: "/career/career-postings",
      token,
      method: "POST",
      body: { title: "New Unit Lead", organization_unit_id: unit.id },
    })

    expect(created.status).toBe(201)

    const parsed = careerPostingResponseSchema.parse(await created.json())

    expect(parsed.organization_unit_id).toBe(unit.id)
    expect(parsed.organization_unit_name).toBe("新設部")

    const stored = await db
      .prepare("SELECT organization_unit_id FROM career_postings WHERE id = ?1")
      .bind(parsed.id)
      .first<{ organization_unit_id: string | null }>()

    expect(stored?.organization_unit_id).toBe(unit.id)
  })
})
