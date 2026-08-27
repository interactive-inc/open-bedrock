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

const jwtSecret = "skills-me-skill-code-route-test-secret"

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

function otherMemberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(9),
  })
}

async function request(props: {
  path: string
  token: string | null
  method?: string
  db?: D1Database
}): Promise<Response> {
  return requestWithContext({
    db: props.db ?? (await createTestDb()),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
  })
}

describe("GET /employee-skills/me/:skillCode", () => {
  test("returns 200 with the joined skill the token employee registered", async () => {
    const response = await request({
      path: "/skill/employee-skills/me/typescript",
      token: await memberToken(),
    })

    expect(response.status).toBe(200)

    const parsed = employeeSkillResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.skill_code).toBe("typescript")
      expect(parsed.data.skill_name).toBe("TypeScript")
      expect(parsed.data.skill_category).toBe("プログラミング")
      expect(parsed.data.level).toBe(5)
      expect(parsed.data.years).toBe(8)
    }
  })

  test("returns 404 when the employee has not registered the skill", async () => {
    const response = await request({
      path: "/skill/employee-skills/me/typescript",
      token: await otherMemberToken(),
    })

    expect(response.status).toBe(404)
  })

  test("returns 404 when the skill code does not exist", async () => {
    const response = await request({
      path: "/skill/employee-skills/me/missing",
      token: await memberToken(),
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/skill/employee-skills/me/typescript", token: null })

    expect(response.status).toBe(401)
  })
})

describe("DELETE /employee-skills/me/:skillCode", () => {
  test("returns 204 and removes the registered skill", async () => {
    const token = await memberToken()

    const db = await createTestDb()

    const deleteResponse = await request({
      path: "/skill/employee-skills/me/typescript",
      token,
      method: "DELETE",
      db,
    })

    expect(deleteResponse.status).toBe(204)

    const getResponse = await request({ path: "/skill/employee-skills/me/typescript", token, db })

    expect(getResponse.status).toBe(404)
  })

  test("returns 404 when the employee has not registered the skill", async () => {
    const response = await request({
      path: "/skill/employee-skills/me/typescript",
      token: await otherMemberToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/skill/employee-skills/me/typescript",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
