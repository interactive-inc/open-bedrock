import { describe, expect, test } from "bun:test"
import { seedEmployeeSkills } from "@/contexts/skill/infrastructure/seed/seed-employee-skills"
import { seedSkills } from "@/contexts/skill/infrastructure/seed/seed-skills"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
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
    "skill_definitions",
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

describe("GET /employee-skills/me", () => {
  test("returns 200 with joined snake_case skills for the token employee", async () => {
    const response = await request({ path: "/employee-skills/me", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeSkillResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)

      const typescript = parsed.data.data.find((row) => row.skill_code === "typescript")

      expect(typescript?.skill_name).toBe("TypeScript")
      expect(typescript?.skill_category).toBe("プログラミング")
      expect(typescript?.level).toBe(5)
      expect(typescript?.years).toBe(8)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/employee-skills/me", token: null })

    expect(response.status).toBe(401)
  })
})
