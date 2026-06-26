import { describe, expect, test } from "bun:test"
import { seedApplicationTemplates } from "@/infrastructure/seed/seed-application-templates"
import { seedApplications } from "@/infrastructure/seed/seed-applications"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "application-crud-route-test-secret"

const applicationUpdatedResponseSchema = z.object({
  id: z.number(),
  status: z.enum(["pending", "approved", "rejected"]),
  payload: z.object({ reason: z.string() }),
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

describe("PUT /applications/:id", () => {
  test("returns 200 and updates payload for the applicant on a pending application", async () => {
    const response = await request("/applications/1", await tokenFor(5, "member"), {
      method: "PUT",
      body: { payload: { start_date: "2026-08-01", end_date: "2026-08-02", reason: "updated" } },
    })

    expect(response.status).toBe(200)

    const parsed = applicationUpdatedResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.payload.reason).toBe("updated")
    }
  })

  test("returns 403 when not the applicant", async () => {
    const response = await request("/applications/1", await tokenFor(9, "member"), {
      method: "PUT",
      body: { payload: { reason: "intruder" } },
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when the application is already decided", async () => {
    const response = await request("/applications/3", await tokenFor(10, "member"), {
      method: "PUT",
      body: { payload: { reason: "too late" } },
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request("/applications/9999", await tokenFor(5, "member"), {
      method: "PUT",
      body: { payload: {} },
    })

    expect(response.status).toBe(404)
  })

  test("returns 404 for a non numeric id", async () => {
    const response = await request("/applications/abc", await tokenFor(5, "member"), {
      method: "PUT",
      body: { payload: {} },
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/applications/1", null, {
      method: "PUT",
      body: { payload: {} },
    })

    expect(response.status).toBe(401)
  })
})

describe("DELETE /applications/:id", () => {
  test("returns 204 when the applicant withdraws a pending application", async () => {
    const response = await request("/applications/1", await tokenFor(5, "member"), {
      method: "DELETE",
      body: {},
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when not the applicant", async () => {
    const response = await request("/applications/1", await tokenFor(9, "member"), {
      method: "DELETE",
      body: {},
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when the application is already decided", async () => {
    const response = await request("/applications/3", await tokenFor(10, "member"), {
      method: "DELETE",
      body: {},
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request("/applications/9999", await tokenFor(5, "member"), {
      method: "DELETE",
      body: {},
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/applications/1", null, { method: "DELETE", body: {} })

    expect(response.status).toBe(401)
  })
})
