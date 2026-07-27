import { describe, expect, test } from "bun:test"
import { seedApplicationTemplates } from "@/infrastructure/seed/seed-application-templates"
import { seedApplications } from "@/infrastructure/seed/seed-applications"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "application-mine-route-test-secret"

const applicationMineResponseSchema = z.object({
  id: z.number(),
  template_name: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  current_step: z.string().nullable(),
  created_at: z.string(),
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
    "application_requests",
    seedApplications.map((application) => ({
      id: application.id,
      template_id: application.templateId,
      applicant_id: application.applicantId,
      status: application.status,
      current_step: application.currentStep,
      payload: JSON.stringify(application.payload),
      created_at: application.createdAt,
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

describe("GET /applications", () => {
  test("returns 200 with the mine columns for the token employee", async () => {
    const response = await request("/applications", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationMineResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)

      const first = parsed.data.data.find((item) => item.id === 1)

      expect(first?.template_name).toBe("Paid Leave Request")
    }
  })

  test("filters by status", async () => {
    const response = await request("/applications?status=approved", await tokenFor(10, "member"))

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationMineResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.status).toBe("approved")
    }
  })

  test("returns only 1 application when limit=1", async () => {
    const response = await request("/applications?limit=1", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationMineResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/applications", null)

    expect(response.status).toBe(401)
  })
})
