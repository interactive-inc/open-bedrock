import { describe, expect, test } from "bun:test"
import { seedEmployeeSkills } from "@/infrastructure/seed/seed-employee-skills"
import { seedSkills } from "@/infrastructure/seed/seed-skills"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const jwtSecret = "skills-me-route-test-secret"

const employeeSkillResponseSchema = z.object({
  skill_code: z.string(),
  skill_name: z.string(),
  skill_category: z.string(),
  level: z.number(),
  years: z.number().nullable(),
  note: z.string().nullable(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "skills",
    seedSkills.map((skill) => ({
      code: skill.code,
      name: skill.name,
      category: skill.category,
    })),
  )

  await seedD1(
    db,
    "employee_skills",
    seedEmployeeSkills.map((employeeSkill) => ({
      employee_id: employeeSkill.employeeId,
      skill_code: employeeSkill.skillCode,
      level: employeeSkill.level,
      years: employeeSkill.years,
      note: employeeSkill.note,
    })),
  )

  return db
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
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

describe("GET /skills/me", () => {
  test("returns 200 with joined snake_case skills for the token employee", async () => {
    const response = await request({ path: "/skills/me", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z.array(employeeSkillResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(2)

      const typescript = parsed.data.find((row) => row.skill_code === "typescript")

      expect(typescript?.skill_name).toBe("TypeScript")
      expect(typescript?.skill_category).toBe("Programming")
      expect(typescript?.level).toBe(5)
      expect(typescript?.years).toBe(8)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/skills/me", token: null })

    expect(response.status).toBe(401)
  })
})
