import { describe, expect, test } from "bun:test"
import { seedEmployeeSkills } from "@/infrastructure/seed/seed-employee-skills"
import { seedSkills } from "@/infrastructure/seed/seed-skills"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "skills-list-route-test-secret"

const skillResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
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

describe("GET /skill-definitions", () => {
  test("returns 200 with a bare array of skills", async () => {
    const response = await request({ path: "/skill-definitions", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(skillResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(12)
    }
  })

  test("filters by q keyword", async () => {
    const response = await request({
      path: "/skill-definitions?q=react",
      token: await memberToken(),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(skillResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.code).toBe("react")
    }
  })

  test("treats % as a literal so it cannot match every skill", async () => {
    const response = await request({ path: "/skill-definitions?q=%25", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(skillResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(0)
    }
  })

  test("treats _ as a literal so it matches only codes containing an underscore", async () => {
    const response = await request({ path: "/skill-definitions?q=_", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(skillResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((skill) => skill.code.includes("_"))).toBe(true)
      expect(parsed.data.data.length).toBeLessThan(12)
    }
  })

  test("returns only 1 skill when limit=1", async () => {
    const response = await request({
      path: "/skill-definitions?limit=1",
      token: await memberToken(),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(skillResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/skill-definitions", token: null })

    expect(response.status).toBe(401)
  })
})
