import { describe, expect, test } from "bun:test"
import { seedCareerPostings } from "@/contexts/career/infrastructure/seed/seed-career-postings"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
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

const jwtSecret = "career-postings-route-test-secret"

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

describe("GET /career-postings", () => {
  test("returns 200 with open postings in snake_case table shape", async () => {
    const response = await request({ path: "/career-postings", token: await tokenForEmployee(1) })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: careerPostingResponseSchema.array(), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((posting) => posting.status === "open")).toBe(true)

      const first = parsed.data.data.find((posting) => posting.id === 1)

      expect(first?.title).toBe("プロダクト開発リード")
      expect(first?.dept_name).toBe("開発部")
      expect(first?.required_skills).toBe("typescript,project_mgmt")

      const closed = parsed.data.data.find((posting) => posting.id === 3)

      expect(closed).toBeUndefined()
    }
  })

  test("returns only 1 posting when limit=1", async () => {
    const response = await request({
      path: "/career-postings?limit=1",
      token: await tokenForEmployee(1),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: careerPostingResponseSchema.array(), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.status).toBe("open")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/career-postings", token: null })

    expect(response.status).toBe(401)
  })
})
