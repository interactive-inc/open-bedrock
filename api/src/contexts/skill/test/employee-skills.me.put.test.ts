import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployeeSkills } from "@/contexts/skill/test/seed/seed-employee-skills.test-support"
import { seedSkills } from "@/contexts/skill/test/seed/seed-skills.test-support"
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

const jwtSecret = "skills-me-update-route-test-secret"

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
  await initializeStandardCompanyTestState(db)

  return db
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(5),
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

describe("PUT /employee-skills/me", () => {
  test("returns 200 and the joined upserted skill", async () => {
    const response = await request({
      path: "/skill/employee-skills/me",
      token: await memberToken(),
      method: "PUT",
      body: { skill_code: "react", level: 4, years: 3 },
    })

    expect(response.status).toBe(200)

    const parsed = employeeSkillResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.skill_code).toBe("react")
      expect(parsed.data.skill_name).toBe("React")
      expect(parsed.data.skill_category).toBe("フロントエンド")
      expect(parsed.data.level).toBe(4)
      expect(parsed.data.years).toBe(3)
      expect(parsed.data.note).toBeNull()
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/skill/employee-skills/me",
      token: null,
      method: "PUT",
      body: { skill_code: "react", level: 4 },
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 when the body is invalid", async () => {
    const response = await request({
      path: "/skill/employee-skills/me",
      token: await memberToken(),
      method: "PUT",
      body: { skill_code: "react" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 404 when the skill code does not exist", async () => {
    const response = await request({
      path: "/skill/employee-skills/me",
      token: await memberToken(),
      method: "PUT",
      body: { skill_code: "missing", level: 4 },
    })

    expect(response.status).toBe(404)
  })
})
