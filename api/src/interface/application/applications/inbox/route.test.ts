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

const jwtSecret = "application-inbox-route-test-secret"

const applicationInboxResponseSchema = z.object({
  id: z.number(),
  template_name: z.string(),
  applicant_name: z.string(),
  current_step: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
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

describe("GET /applications/inbox", () => {
  test("returns 200 with the inbox columns and joined names", async () => {
    const response = await request("/applications/inbox", await tokenFor(2, "manager"))

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationInboxResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)

      const first = parsed.data.data.find((item) => item.id === 1)

      expect(first?.template_name).toBe("Paid Leave Request")
      expect(first?.applicant_name).toBe("Emery Lane")
      expect(first?.status).toBe("pending")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/applications/inbox", null)

    expect(response.status).toBe(401)
  })

  test("returns 200 with empty data for a role not listed in any approverRoles", async () => {
    const response = await request("/applications/inbox", await tokenFor(99, "member"))

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationInboxResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(0)
      expect(parsed.data.total).toBe(0)
    }
  })

  test("returns only templates matching the viewer role in approverRoles", async () => {
    const db = createD1TestDatabase(loadSchema())

    // template 10: approverRoles に "accountant" を含む
    await seedD1(db, "application_templates", [
      {
        id: 10,
        code: "accounting_only",
        name: "Accounting Template",
        category: "accounting",
        description: null,
        schema_json: "{}",
        approver_roles: JSON.stringify(["accountant"]),
      },
      {
        id: 11,
        code: "manager_only",
        name: "Manager Template",
        category: "general",
        description: null,
        schema_json: "{}",
        approver_roles: JSON.stringify(["manager"]),
      },
    ])

    await seedD1(db, "applications", [
      {
        id: 100,
        template_id: 10,
        applicant_id: 5,
        status: "pending",
        current_step: null,
        payload: "{}",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: 101,
        template_id: 11,
        applicant_id: 5,
        status: "pending",
        current_step: null,
        payload: "{}",
        created_at: "2026-01-01T00:00:00Z",
      },
    ])

    await seedD1(db, "employees", [
      {
        id: 5,
        code: "E005",
        name: "Emery Lane",
        email: "you+e005@example.com",
        password_hash: "hash",
        role: "member",
        dept_id: 3,
        dept_name: "Engineering",
        position: "Engineer",
        status: "active",
      },
      {
        id: 99,
        code: "E099",
        name: "Robin Uchida",
        email: "you+e099@example.com",
        password_hash: "hash",
        role: "accountant",
        dept_id: 6,
        dept_name: "Administration",
        position: "Accountant",
        status: "active",
      },
    ])

    await seedIamForEmployees(db)

    const accountantToken = await tokenFor(99, "accountant")

    const accountantResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/applications/inbox",
      token: accountantToken,
    })

    expect(accountantResponse.status).toBe(200)

    const accountantParsed = z
      .object({ data: z.array(applicationInboxResponseSchema), total: z.number() })
      .safeParse(await accountantResponse.json())

    expect(accountantParsed.success).toBe(true)

    if (accountantParsed.success) {
      expect(accountantParsed.data.data.length).toBe(1)
      expect(accountantParsed.data.data[0].id).toBe(100)
    }
  })
})
