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

async function seedCompletedWorkflow(db: D1Database): Promise<void> {
  await db
    .prepare(
      "UPDATE application_requests SET status = 'approved', current_step = NULL WHERE id = 1",
    )
    .run()
  await seedD1(db, "application_workflow_instances", [
    {
      application_id: 1,
      definition_json: JSON.stringify({
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
      }),
      current_step_key: "manager",
      current_round: 1,
      started_at: "2026-01-01T00:00:00.000Z",
      due_at: null,
    },
  ])
  await seedD1(db, "application_workflow_step_snapshots", [
    {
      application_id: 1,
      step_key: "manager",
      round: 1,
      required_approvals: 1,
      activated_at: "2026-01-01T00:00:00.000Z",
      resolution_reason: "activation",
      resolution_id: "completed-workflow",
    },
  ])
  await seedD1(db, "application_workflow_step_candidates", [
    {
      application_id: 1,
      step_key: "manager",
      round: 1,
      candidate_employee_id: 2,
      candidate_account_id: 2,
      source: "primary",
      selectors_json: "[]",
      resolution_id: "completed-workflow",
      resolved_at: "2026-01-01T00:00:00.000Z",
    },
  ])
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
    const response = await request("/applications/1", await tokenFor(4, "manager"))

    expect(response.status).toBe(200)
  })

  test("returns 200 for application:read:all holder even when template approverRoles does not include them", async () => {
    // seedApplications の id=1 は templateId=1 (paid_leave, approverRoles=["manager"])。
    // hr は "manager" ではないが application:read:all を持つので詳細を閲覧できる。
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
        id: 5,
        code: "E005",
        name: "Emery Lane",
        dept_id: 3,
        dept_name: "Engineering",
        position: "Engineer",
        status: "active",
      },
      {
        id: 200,
        code: "E200",
        name: "HR User",
        dept_id: 2,
        dept_name: "Human Resources",
        position: "HR",
        status: "active",
      },
    ])

    await seedIamForEmployees(db, [
      { id: 5, email: "you+e005@example.com", passwordHash: "hash", role: "member" },
      { id: 200, email: "you+e200@example.com", passwordHash: "hash", role: "hr" },
    ])
    await db
      .prepare(
        "UPDATE application_requests SET status = 'approved', current_step = NULL WHERE id = 1",
      )
      .run()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/applications/1",
      token: await tokenFor(200, "hr"),
    })

    expect(response.status).toBe(200)
  })

  for (const status of ["approved", "rejected"] as const) {
    test(`does not grant ${status} instance-less legacy history to a manager assigned later`, async () => {
      const db = await createTestDb()
      await db
        .prepare("UPDATE application_requests SET status = ?2, current_step = NULL WHERE id = ?1")
        .bind(1, status)
        .run()
      await db
        .prepare(
          "UPDATE org_memberships SET manager_employee_code = 'E002' WHERE employee_code = 'E005'",
        )
        .run()

      expect(
        await db
          .prepare(
            "SELECT COUNT(*) AS total FROM application_workflow_instances WHERE application_id = 1",
          )
          .first<number>("total"),
      ).toBe(0)

      const response = await requestWithContext({
        db,
        jwtSecret,
        path: "/applications/1",
        token: await tokenFor(2, "manager"),
      })

      expect(response.status).toBe(403)
    })
  }

  test("keeps completed instance-less legacy history visible to its persisted participant", async () => {
    const db = await createTestDb()
    await db
      .prepare(
        "UPDATE application_requests SET status = 'approved', current_step = NULL WHERE id = 1",
      )
      .run()
    await seedD1(db, "application_approvals", [
      {
        id: 100,
        application_id: 1,
        approver_id: 3,
        action: "approve",
        comment: "recorded before the organization changed",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ])

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/applications/1",
      token: await tokenFor(3, "member"),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id: 1,
      status: "approved",
      payload: { start_date: "2026-06-10" },
      approvals: [{ id: 100, action: "approve" }],
      workflow: null,
    })
  })

  test("does not grant completed legacy history to a manager assigned after completion", async () => {
    const db = await createTestDb()
    await db
      .prepare(
        "UPDATE application_requests SET status = 'approved', current_step = NULL WHERE id = 1",
      )
      .run()
    await db
      .prepare(
        "UPDATE org_memberships SET manager_employee_code = 'E003' WHERE employee_code = 'E005'",
      )
      .run()
    await seedD1(db, "application_workflow_instances", [
      {
        application_id: 1,
        definition_json: JSON.stringify({
          version: 1,
          steps: [
            {
              key: "manager",
              name: "Manager",
              approvers: [{ type: "direct_manager" }],
              approval_mode: "any",
              condition_mode: "all",
              conditions: [],
              due_days: null,
              escalation_approvers: [],
              rejection_behavior: "reject",
              allow_delegation: true,
            },
          ],
        }),
        current_step_key: "manager",
        current_round: 1,
        started_at: "2026-01-01T00:00:00.000Z",
        due_at: null,
      },
    ])

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/applications/1",
      token: await tokenFor(3, "manager"),
    })

    expect(response.status).toBe(403)
    const snapshotCount = await db
      .prepare("SELECT COUNT(*) AS total FROM application_workflow_step_snapshots")
      .first<number>("total")
    expect(snapshotCount).toBe(0)
  })

  test("does not grant completed workflow history through a delegation created later", async () => {
    const db = await createTestDb()
    await seedCompletedWorkflow(db)
    await seedD1(db, "approval_delegations", [
      {
        id: 20,
        delegator_employee_id: 2,
        delegate_employee_id: 6,
        template_code: "paid_leave",
        starts_at: "2026-07-01T00:00:00.000Z",
        ends_at: "2026-08-01T00:00:00.000Z",
        created_at: "2026-07-01T00:00:00.000Z",
        created_by_account_id: 2,
      },
    ])

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/applications/1",
      token: await tokenFor(6, "member"),
      now: "2026-07-14T00:00:00.000Z",
    })

    expect(response.status).toBe(403)
  })

  test("keeps completed history visible to the delegate who actually decided", async () => {
    const db = await createTestDb()
    await seedCompletedWorkflow(db)
    await seedD1(db, "approval_delegations", [
      {
        id: 21,
        delegator_employee_id: 2,
        delegate_employee_id: 6,
        template_code: "paid_leave",
        starts_at: "2026-01-01T00:00:00.000Z",
        ends_at: "2026-01-03T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        created_by_account_id: 2,
      },
    ])
    await seedD1(db, "application_workflow_approvals", [
      {
        application_id: 1,
        step_key: "manager",
        round: 1,
        approver_id: 6,
        approver_account_id: 6,
        represented_approver_id: 2,
        delegation_id: 21,
        action: "approve",
        comment: null,
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ])

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/applications/1",
      token: await tokenFor(6, "member"),
      now: "2026-07-14T00:00:00.000Z",
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      approver_roles: [],
      workflow: { current_round: 1 },
    })
  })
})
