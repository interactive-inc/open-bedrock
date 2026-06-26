import { describe, expect, test } from "bun:test"
import { seedApplicationTemplates } from "@/infrastructure/seed/seed-application-templates"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "application-template-create-route-test-secret"

const applicationTemplateResponseSchema = z.object({
  id: z.number().nullable(),
  code: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  schema_json: z.unknown(),
  approver_roles: z.array(z.string()).readonly(),
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
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
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

describe("POST /application-templates", () => {
  test("privileged role creates a template and returns 201", async () => {
    const response = await request("/application-templates", await tokenFor(1, "admin"), {
      method: "POST",
      body: {
        code: "new_template",
        name: "New Template",
        category: "general",
        schema_json: { type: "object" },
        approver_roles: ["manager"],
      },
    })

    expect(response.status).toBe(201)

    const parsed = applicationTemplateResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("new_template")
      expect(parsed.data.approver_roles).toEqual(["manager"])
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/application-templates", await tokenFor(5, "member"), {
      method: "POST",
      body: { code: "member_template", name: "X", category: "general", schema_json: {} },
    })

    expect(response.status).toBe(403)
  })

  test("duplicate code returns 409", async () => {
    const response = await request("/application-templates", await tokenFor(1, "admin"), {
      method: "POST",
      body: { code: "paid_leave", name: "Duplicate", category: "attendance", schema_json: {} },
    })

    expect(response.status).toBe(409)
  })

  test("returns 400 when a required field is missing", async () => {
    const response = await request("/application-templates", await tokenFor(1, "admin"), {
      method: "POST",
      body: { name: "No Code", category: "general", schema_json: {} },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/application-templates", null, {
      method: "POST",
      body: { code: "x", name: "X", category: "general", schema_json: {} },
    })

    expect(response.status).toBe(401)
  })
})
