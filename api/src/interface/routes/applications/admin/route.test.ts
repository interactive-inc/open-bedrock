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

const jwtSecret = "application-admin-route-test-secret"

const applicationAdminResponseSchema = z.object({
  id: z.number(),
  template_code: z.string(),
  template_name: z.string(),
  template_category: z.string(),
  applicant_id: z.number(),
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  current_step: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

const listSchema = z.object({
  data: z.array(applicationAdminResponseSchema),
  total: z.number(),
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

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path,
    token,
  })
}

describe("GET /applications/admin", () => {
  test("returns 200 with all applications for admin", async () => {
    const response = await request("/applications/admin", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedApplications.length)
      expect(parsed.data.data.length).toBe(seedApplications.length)

      const first = parsed.data.data.find((item) => item.id === 1)

      expect(first?.template_name).toBe("Paid Leave Request")
      expect(first?.applicant_name).toBe("Emery Lane")
      expect(first?.applicant_id).toBe(5)
    }
  })

  test("returns 200 with all applications for hr", async () => {
    // seedEmployees の id=2 は manager 固定なので、hr 用に別 employee を差し込む。
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

    await seedD1(db, "employees", [
      {
        id: 200,
        code: "E200",
        name: "HR User",
        dept_id: 2,
        dept_name: "Human Resources",
        position: "HR Manager",
        status: "active",
      },
    ])

    await seedIamForEmployees(db, [
      { id: 200, email: "you+e200@example.com", passwordHash: "hash", role: "hr" },
    ])

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/applications/admin",
      token: await tokenFor(200, "hr"),
    })

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedApplications.length)
    }
  })

  test("returns 403 for manager", async () => {
    const response = await request("/applications/admin", await tokenFor(4, "manager"))

    expect(response.status).toBe(403)
  })

  test("returns 403 for member", async () => {
    const response = await request("/applications/admin", await tokenFor(5, "member"))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/applications/admin", null)

    expect(response.status).toBe(401)
  })

  test("filters by status", async () => {
    const response = await request("/applications/admin?status=approved", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.status === "approved")).toBe(true)

      const expectedCount = seedApplications.filter((item) => item.status === "approved").length

      expect(parsed.data.total).toBe(expectedCount)
    }
  })

  test("filters by applicant_id", async () => {
    const response = await request("/applications/admin?applicant_id=5", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.applicant_id === 5)).toBe(true)
    }
  })

  test("filters by template_code", async () => {
    const response = await request(
      "/applications/admin?template_code=paid_leave",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBeGreaterThan(0)
      expect(parsed.data.data.every((item) => item.template_code === "paid_leave")).toBe(true)
    }
  })

  test("filters by created_at range", async () => {
    const response = await request(
      "/applications/admin?from=2026-05-20T00:00:00Z&to=2026-05-23T00:00:00Z",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.data.every((item) => item.created_at >= "2026-05-20T00:00:00Z")).toBe(true)
      expect(parsed.data.data.every((item) => item.created_at <= "2026-05-23T00:00:00Z")).toBe(true)
    }
  })

  test("sorts by created_at ascending", async () => {
    const response = await request(
      "/applications/admin?sort=created_at_asc",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const dates = parsed.data.data.map((item) => item.created_at)

      const sorted = [...dates].sort()

      expect(dates).toEqual(sorted)
    }
  })

  test("respects limit and offset", async () => {
    const response = await request(
      "/applications/admin?limit=2&offset=1",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.total).toBe(seedApplications.length)
    }
  })

  test("silently ignores non-numeric applicant_id", async () => {
    const response = await request(
      "/applications/admin?applicant_id=abc",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedApplications.length)
    }
  })

  test("returns empty when template_code does not match any template", async () => {
    const response = await request(
      "/applications/admin?template_code=does_not_exist",
      await tokenFor(1, "root"),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(0)
      expect(parsed.data.data.length).toBe(0)
    }
  })
})
