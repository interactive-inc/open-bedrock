import { describe, expect, test } from "bun:test"
import { seedApplicationTemplates } from "@/infrastructure/seed/seed-application-templates"
import { seedApplications } from "@/infrastructure/seed/seed-applications"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOrgMemberships } from "@/infrastructure/seed/seed-org-memberships"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
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
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)
  await seedD1(
    db,
    "org_memberships",
    seedOrgMemberships.map((membership) => ({
      department_code: membership.departmentCode,
      employee_code: membership.employeeCode,
      manager_employee_code: membership.managerEmployeeCode,
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

describe("GET /applications/inbox", () => {
  test("returns 200 with the inbox columns and joined names", async () => {
    const response = await request("/applications/inbox", await tokenFor(1, "admin"))

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

  test("does not list legacy applications outside a manager's organization scope", async () => {
    const response = await request("/applications/inbox", await tokenFor(2, "manager"))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: [], total: 0 })
  })

  test("does not persist legacy workflow authority when an unrelated user opens the inbox", async () => {
    const db = await createTestDb()
    const definition = JSON.stringify({
      version: 1,
      steps: [
        {
          key: "manager",
          name: "Manager",
          approvers: [{ type: "employee", employee_code: "E002" }],
          approval_mode: "any",
          condition_mode: "all",
          conditions: [],
          due_days: null,
          escalation_approvers: [],
          rejection_behavior: "reject",
          allow_delegation: true,
        },
      ],
    })
    await seedD1(db, "application_workflow_instances", [
      {
        application_id: 1,
        definition_json: definition,
        current_step_key: "manager",
        current_round: 1,
        started_at: "2026-01-01T00:00:00.000Z",
        due_at: null,
      },
    ])
    await db.prepare("UPDATE applications SET current_step = 'manager' WHERE id = 1").run()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/applications/inbox",
      token: await tokenFor(99, "member"),
    })

    expect(response.status).toBe(200)
    const snapshotCount = await db
      .prepare("SELECT COUNT(*) AS total FROM application_workflow_step_snapshots")
      .first<number>("total")
    expect(snapshotCount).toBe(0)
  })

  test("paginates a large workflow inbox with a constant number of database queries", async () => {
    let queryCount = 0
    const db = createD1TestDatabase(loadSchema(), {
      onQuery: () => {
        queryCount += 1
      },
    })
    await seedD1(db, "application_templates", [
      {
        id: 100,
        code: "large_workflow",
        name: "Large workflow",
        category: "general",
        description: null,
        schema_json: "{}",
        approver_roles: "[]",
      },
    ])
    await seedD1(db, "employees", [
      { id: 2, code: "E002", name: "Manager", status: "active" },
      { id: 5, code: "E005", name: "Applicant", status: "active" },
    ])
    await seedIamForEmployees(db, [
      { id: 2, email: "you+e002@example.com", passwordHash: "hash", role: "manager" },
      { id: 5, email: "you+e005@example.com", passwordHash: "hash", role: "member" },
    ])
    const managerAccountId = await db
      .prepare("SELECT id FROM accounts WHERE employee_id = 2")
      .first<number>("id")
    if (managerAccountId === null) throw new Error("manager account was not seeded")

    const definition = JSON.stringify({
      version: 1,
      steps: [
        {
          key: "manager",
          name: "Manager",
          approvers: [{ type: "employee", employee_code: "E002" }],
          approval_mode: "any",
          condition_mode: "all",
          conditions: [],
          due_days: null,
          escalation_approvers: [],
          rejection_behavior: "reject",
          allow_delegation: true,
        },
      ],
    })
    const ids = Array.from({ length: 100 }, (_, index) => index + 1_000)
    await seedD1(
      db,
      "applications",
      ids.map((id) => ({
        id,
        template_id: 100,
        applicant_id: 5,
        status: "pending",
        current_step: "manager",
        payload: "{}",
        created_at: `2026-01-01T00:00:${String(id - 1_000).padStart(2, "0")}Z`,
      })),
    )
    await seedD1(
      db,
      "application_workflow_instances",
      ids.map((id) => ({
        application_id: id,
        definition_json: definition,
        current_step_key: "manager",
        current_round: 1,
        started_at: "2026-01-01T00:00:00.000Z",
        due_at: null,
      })),
    )
    await seedD1(
      db,
      "application_workflow_step_snapshots",
      ids.map((id) => ({
        application_id: id,
        step_key: "manager",
        round: 1,
        required_approvals: 1,
        activated_at: "2026-01-01T00:00:00.000Z",
        due_at: null,
        escalated_at: null,
        resolution_reason: "activation",
        resolution_id: `resolution-${id}`,
      })),
    )
    await seedD1(
      db,
      "application_workflow_step_candidates",
      ids.map((id) => ({
        application_id: id,
        step_key: "manager",
        round: 1,
        candidate_employee_id: 2,
        candidate_account_id: managerAccountId,
        source: "primary",
        selectors_json: "[]",
        resolution_id: `resolution-${id}`,
        eligible_from: null,
        resolved_at: "2026-01-01T00:00:00.000Z",
      })),
    )

    queryCount = 0
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/applications/inbox?limit=10",
      token: await tokenFor(2, "manager"),
    })
    const body = z
      .object({ data: z.array(applicationInboxResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(response.status).toBe(200)
    expect([body.data.length, body.total]).toEqual([10, 100])
    expect(queryCount).toBeLessThanOrEqual(20)
  })

  test("returns only templates matching the viewer role in approverRoles", async () => {
    const db = createD1TestDatabase(loadSchema())

    // template 10: approverRoles に "hr" を含む
    await seedD1(db, "application_templates", [
      {
        id: 10,
        code: "hr_only",
        name: "HR Template",
        category: "hr",
        description: null,
        schema_json: "{}",
        approver_roles: JSON.stringify(["hr"]),
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
        dept_id: 3,
        dept_name: "Engineering",
        position: "Engineer",
        status: "active",
      },
      {
        id: 99,
        code: "E099",
        name: "Robin Uchida",
        dept_id: 6,
        dept_name: "Administration",
        position: "HR",
        status: "active",
      },
    ])

    await seedIamForEmployees(db, [
      { id: 5, email: "you+e005@example.com", passwordHash: "hash", role: "member" },
      { id: 99, email: "you+e099@example.com", passwordHash: "hash", role: "hr" },
    ])

    const hrToken = await tokenFor(99, "hr")

    const hrResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/applications/inbox",
      token: hrToken,
    })

    expect(hrResponse.status).toBe(200)

    const hrParsed = z
      .object({ data: z.array(applicationInboxResponseSchema), total: z.number() })
      .safeParse(await hrResponse.json())

    expect(hrParsed.success).toBe(true)

    if (hrParsed.success) {
      expect(hrParsed.data.data.length).toBe(1)
      expect(hrParsed.data.data[0].id).toBe(100)
    }
  })
})
