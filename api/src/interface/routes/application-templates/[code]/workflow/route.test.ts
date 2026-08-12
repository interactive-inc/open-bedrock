import { app } from "@/app"
import { seedApplicationTemplates } from "@/infrastructure/seed/seed-application-templates"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"

const jwtSecret = "workflow-route-test-secret"
const now = "2026-07-14T10:00:00.000Z"

async function setup() {
  const db = createD1TestDatabase(loadSchema())
  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      status: employee.status,
    })),
  )
  await seedIamForEmployees(db)
  await db
    .prepare(
      `INSERT INTO accounts (id, status, token_version, created_at, updated_at)
       SELECT 20, status, token_version, created_at, updated_at
       FROM accounts
       WHERE id = 2`,
    )
    .run()
  await db.prepare("UPDATE account_employee_links SET account_id = 20 WHERE account_id = 2").run()
  await db.prepare("UPDATE identities SET account_id = 20 WHERE account_id = 2").run()
  await db.prepare("UPDATE account_roles SET account_id = 20 WHERE account_id = 2").run()
  await db
    .prepare(
      `INSERT OR IGNORE INTO account_roles (account_id, role_id, granted_by, granted_at)
       SELECT 20, id, 1, 0 FROM roles WHERE key = 'hr'`,
    )
    .run()
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
  return db
}

function token(employeeId: number, role: string, accountId = employeeId) {
  return createTestToken(jwtSecret, {
    employeeId,
    accountId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

const definition = {
  version: 1 as const,
  steps: [
    {
      key: "manager",
      name: "Manager",
      approvers: [{ type: "direct_manager" as const }],
      approval_mode: "any" as const,
      condition_mode: "all" as const,
      conditions: [],
      due_days: null,
      escalation_approvers: [],
      rejection_behavior: "return" as const,
      allow_delegation: true,
    },
  ],
}

async function request(
  db: D1Database,
  role: string,
  employeeId: number,
  method: "GET" | "PUT",
  body?: unknown,
  accountId = employeeId,
) {
  return app.request(
    "/application-templates/paid_leave/workflow",
    {
      method,
      headers: {
        Authorization: `Bearer ${await token(employeeId, role, accountId)}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    {
      DB: db,
      JWT_SECRET: jwtSecret,
      AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
      NOW: now,
    },
  )
}

describe("application template workflow route", () => {
  test("admin saves and reads a revisioned workflow", async () => {
    const db = await setup()
    const saved = await request(db, "root", 1, "PUT", {
      ...definition,
      expected_revision: 0,
    })
    expect(saved.status).toBe(200)
    expect(await saved.json()).toEqual({
      workflow: definition,
      revision: 1,
      updated_at: now,
    })

    const response = await request(db, "root", 1, "GET")
    expect(response.status).toBe(200)
    const result = (await response.json()) as {
      workflow: { steps: Array<{ key: string }> }
      revision: number
      updated_at: string
    }
    expect(result.workflow.steps[0]?.key).toBe("manager")
    expect(result.revision).toBe(1)
    expect(result.updated_at).toBe(now)
  })

  test("requires the caller's expected revision", async () => {
    expect((await request(await setup(), "root", 1, "PUT", definition)).status).toBe(400)
  })

  test("manager cannot change company-wide workflow settings", async () => {
    expect(
      (
        await request(await setup(), "manager", 4, "PUT", {
          ...definition,
          expected_revision: 0,
        })
      ).status,
    ).toBe(403)
  })

  test("rejects references to an unknown IAM role", async () => {
    const invalid = {
      ...definition,
      steps: [{ ...definition.steps[0], approvers: [{ type: "role", role_key: "missing_role" }] }],
      expected_revision: 0,
    }
    expect((await request(await setup(), "root", 1, "PUT", invalid)).status).toBe(422)
  })

  test("records the authenticated account rather than the linked employee as actor", async () => {
    const db = await setup()
    expect(
      (
        await request(db, "root", 1, "PUT", {
          ...definition,
          expected_revision: 0,
        })
      ).status,
    ).toBe(200)

    const saved = await request(
      db,
      "hr",
      2,
      "PUT",
      {
        ...definition,
        steps: [{ ...definition.steps[0], name: "HR revision" }],
        expected_revision: 1,
      },
      20,
    )
    expect(saved.status).toBe(200)

    const actors = await db
      .prepare(
        `SELECT revision, updated_by_account_id FROM application_workflow_revisions
         WHERE template_id = 1 ORDER BY revision`,
      )
      .all<{ revision: number; updated_by_account_id: number }>()
    expect(actors.results).toEqual([
      { revision: 1, updated_by_account_id: 1 },
      { revision: 2, updated_by_account_id: 20 },
    ])
  })

  test("allows only one parallel writer and records the winning actor and immutable revision", async () => {
    const db = await setup()
    const created = await request(db, "root", 1, "PUT", {
      ...definition,
      expected_revision: 0,
    })
    expect(created.status).toBe(200)

    const variants = [
      {
        actorAccountId: 1,
        employeeId: 1,
        role: "root",
        name: "Admin revision",
      },
      {
        actorAccountId: 20,
        employeeId: 2,
        role: "hr",
        name: "HR revision",
      },
    ] as const
    const responses = await Promise.all(
      variants.map((variant) =>
        request(
          db,
          variant.role,
          variant.employeeId,
          "PUT",
          {
            ...definition,
            steps: [{ ...definition.steps[0], name: variant.name }],
            expected_revision: 1,
          },
          variant.actorAccountId,
        ),
      ),
    )

    expect(responses.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
      200, 409,
    ])
    const winnerIndex = responses.findIndex((response) => response.status === 200)
    const loserIndex = responses.findIndex((response) => response.status === 409)
    const winner = variants[winnerIndex]
    expect(winner).toBeDefined()
    expect(await responses[loserIndex]?.json()).toEqual({
      error: "workflow definition was updated by another administrator",
      code: "workflow_revision_conflict",
    })

    const current = await db
      .prepare(
        `SELECT definition_json, revision, updated_by_account_id
         FROM application_workflows WHERE template_id = 1`,
      )
      .first<{
        definition_json: string
        revision: number
        updated_by_account_id: number
      }>()
    expect(current?.revision).toBe(2)
    expect(current?.updated_by_account_id).toBe(winner?.actorAccountId)
    expect(JSON.parse(current?.definition_json ?? "{}").steps[0]?.name).toBe(winner?.name)

    const revisions = await db
      .prepare(
        `SELECT revision, definition_json, updated_by_account_id
         FROM application_workflow_revisions
         WHERE template_id = 1 ORDER BY revision`,
      )
      .all<{
        revision: number
        definition_json: string
        updated_by_account_id: number
      }>()
    expect(revisions.results.map((revision) => revision.revision)).toEqual([1, 2])
    expect(revisions.results.map((revision) => revision.updated_by_account_id)).toEqual([
      1,
      winner?.actorAccountId,
    ])
    expect(JSON.parse(revisions.results[0]?.definition_json ?? "{}").steps[0]?.name).toBe("Manager")
    expect(JSON.parse(revisions.results[1]?.definition_json ?? "{}").steps[0]?.name).toBe(
      winner?.name,
    )

    expect(
      db
        .prepare(
          `UPDATE application_workflow_revisions SET definition_json = '{}'
           WHERE template_id = 1 AND revision = 1`,
        )
        .run(),
    ).rejects.toThrow("append-only")
  })

  test("rolls back the current definition when the audit revision cannot be inserted", async () => {
    const db = await setup()
    expect(
      (
        await request(db, "root", 1, "PUT", {
          ...definition,
          expected_revision: 0,
        })
      ).status,
    ).toBe(200)
    await db
      .prepare(
        `INSERT INTO application_workflow_revisions
           (template_id, revision, definition_json, updated_by_account_id, created_at)
         VALUES (1, 2, '{}', NULL, ?1)`,
      )
      .bind(now)
      .run()

    const failed = await request(db, "root", 1, "PUT", {
      ...definition,
      steps: [{ ...definition.steps[0], name: "Must roll back" }],
      expected_revision: 1,
    })
    expect(failed.status).toBe(500)

    const current = await db
      .prepare(
        `SELECT definition_json, revision, updated_by_account_id
         FROM application_workflows WHERE template_id = 1`,
      )
      .first<{
        definition_json: string
        revision: number
        updated_by_account_id: number
      }>()
    expect(current?.revision).toBe(1)
    expect(current?.updated_by_account_id).toBe(1)
    expect(JSON.parse(current?.definition_json ?? "{}").steps[0]?.name).toBe("Manager")
  })
})
