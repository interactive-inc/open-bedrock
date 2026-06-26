import { describe, expect, test } from "bun:test"
import { seedApplicationApprovals } from "@/infrastructure/seed/seed-application-approvals"
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

const jwtSecret = "application-reject-route-test-secret"

const applicationDecisionResponseSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
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
    "application_approvals",
    seedApplicationApprovals.map((approval) => ({
      id: approval.id,
      application_id: approval.applicationId,
      approver_id: approval.approverId,
      action: approval.action,
      comment: approval.comment,
      created_at: approval.createdAt,
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

describe("POST /applications/:id/reject", () => {
  test("returns 200 and flips status to rejected", async () => {
    const response = await request("/applications/1/reject", await tokenFor(2, "manager"), {
      method: "POST",
      body: { comment: "sending back" },
    })

    expect(response.status).toBe(200)

    const parsed = applicationDecisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("rejected")
    }
  })

  test("returns 400 when comment is empty", async () => {
    const response = await request("/applications/1/reject", await tokenFor(2, "manager"), {
      method: "POST",
      body: { comment: "" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request("/applications/9999/reject", await tokenFor(2, "manager"), {
      method: "POST",
      body: { comment: "sending back" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/applications/1/reject", null, {
      method: "POST",
      body: { comment: "sending back" },
    })

    expect(response.status).toBe(401)
  })

  test("returns 403 for a non-privileged role", async () => {
    const response = await request("/applications/1/reject", await tokenFor(5, "member"), {
      method: "POST",
      body: { comment: "sending back" },
    })

    expect(response.status).toBe(403)
  })
})
