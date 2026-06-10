import { describe, expect, test } from "bun:test"
import { seedApplicationTemplates } from "@/infrastructure/seed/seed-application-templates"
import { seedApplications } from "@/infrastructure/seed/seed-applications"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const jwtSecret = "application-detail-route-test-secret"

const applicationDetailResponseSchema = z.object({
  id: z.number(),
  template_code: z.string(),
  template_name: z.string(),
  applicant_name: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  current_step: z.string().nullable(),
  payload: z.unknown(),
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
    "applications",
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
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

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

describe("GET /applications/:id", () => {
  test("returns 200 with the application detail", async () => {
    const response = await request("/applications/1", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = applicationDetailResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.template_code).toBe("paid_leave")
      expect(parsed.data.applicant_name).toBe("Emery Lane")
    }
  })

  test("returns 404 for a non numeric id", async () => {
    const response = await request("/applications/abc", await tokenFor(5, "member"))

    expect(response.status).toBe(404)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request("/applications/9999", await tokenFor(5, "member"))

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/applications/1", null)

    expect(response.status).toBe(401)
  })

  test("returns 403 for a non-owner non-privileged role (no ID-scan leakage)", async () => {
    const response = await request("/applications/1", await tokenFor(99, "member"))

    expect(response.status).toBe(403)
  })

  test("returns 200 for a privileged non-owner (approver can view)", async () => {
    const response = await request("/applications/1", await tokenFor(2, "manager"))

    expect(response.status).toBe(200)
  })
})
