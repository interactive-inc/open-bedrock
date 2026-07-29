import { describe, expect, test } from "bun:test"
import { seedApplicationTemplates } from "@/infrastructure/seed/seed-application-templates"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "application-templates-route-test-secret"

const applicationTemplateResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "application_templates",
    seedApplicationTemplates.map((template) => ({
      id: template.id,
      code: template.code,
      name: template.name,
      category: template.category,
      description: template.description,
      schema_json: JSON.stringify(template.schemaJson),
      approver_roles: JSON.stringify(template.approverRoles),
    })),
  )

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

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: role,
  })
}

async function request(
  path: string,
  token: string | null,
  init?: { method: string; body: unknown },
): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path,
    token,
    method: init?.method,
    body: init?.body,
  })
}

describe("GET /application-templates", () => {
  test("returns 200 with the template columns", async () => {
    const response = await request("/application-templates", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationTemplateResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(5)

      const paidLeave = parsed.data.data.find((item) => item.code === "paid_leave")

      expect(paidLeave?.name).toBe("有給休暇申請")
      expect(paidLeave?.category).toBe("attendance")
    }
  })

  test("filters by category", async () => {
    const response = await request(
      "/application-templates?category=attendance",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationTemplateResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
    }
  })

  test("returns only 1 template when limit=1", async () => {
    const response = await request("/application-templates?limit=1", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationTemplateResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/application-templates", null)

    expect(response.status).toBe(401)
  })
})
