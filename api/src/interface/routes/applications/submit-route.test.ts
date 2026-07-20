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

const jwtSecret = "application-submit-route-test-secret"

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

describe("POST /applications", () => {
  test("returns 201 with applicant resolved from the token", async () => {
    const response = await request("/applications", await tokenFor(5, "member"), {
      method: "POST",
      body: {
        template_code: "paid_leave",
        payload: { start_date: "2026-08-01", end_date: "2026-08-01" },
      },
    })

    expect(response.status).toBe(201)

    const parsed = applicationDetailResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.template_code).toBe("paid_leave")
      expect(parsed.data.template_name).toBe("Paid Leave Request")
      expect(parsed.data.applicant_name).toBe("Emery Lane")
      expect(parsed.data.status).toBe("pending")
    }
  })

  test("returns 404 when the template code is unknown", async () => {
    const response = await request("/applications", await tokenFor(5, "member"), {
      method: "POST",
      body: { template_code: "missing", payload: {} },
    })

    expect(response.status).toBe(404)
  })

  test.each([
    ["missing required field", { amount: 12_000 }],
    ["wrong field type", { amount: "12000", category: "travel" }],
  ])("returns 422 for an invalid template payload: %s", async (_, payload) => {
    const response = await request("/applications", await tokenFor(5, "member"), {
      method: "POST",
      body: { template_code: "expense", payload },
    })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: "invalid_payload" })
  })

  test("returns 400 when template_code is missing", async () => {
    const response = await request("/applications", await tokenFor(5, "member"), {
      method: "POST",
      body: { payload: {} },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/applications", null, {
      method: "POST",
      body: { template_code: "paid_leave", payload: {} },
    })

    expect(response.status).toBe(401)
  })
})
