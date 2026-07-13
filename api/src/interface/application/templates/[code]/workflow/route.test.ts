import { app } from "@/app"
import { seedApplicationTemplates } from "@/infrastructure/seed/seed-application-templates"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"

const jwtSecret = "workflow-route-test-secret"

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

function token(employeeId: number, role: string) {
  return createTestToken(jwtSecret, {
    employeeId,
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
) {
  return app.request(
    "/application-templates/paid_leave/workflow",
    {
      method,
      headers: {
        Authorization: `Bearer ${await token(employeeId, role)}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { DB: db, JWT_SECRET: jwtSecret },
  )
}

describe("application template workflow route", () => {
  test("admin saves and reads a validated workflow", async () => {
    const db = await setup()
    expect((await request(db, "admin", 1, "PUT", definition)).status).toBe(200)
    const response = await request(db, "admin", 1, "GET")
    expect(response.status).toBe(200)
    const result = (await response.json()) as { workflow: { steps: Array<{ key: string }> } }
    expect(result.workflow.steps[0]?.key).toBe("manager")
  })

  test("manager cannot change company-wide workflow settings", async () => {
    expect((await request(await setup(), "manager", 4, "PUT", definition)).status).toBe(403)
  })

  test("rejects references to an unknown IAM role", async () => {
    const invalid = {
      ...definition,
      steps: [{ ...definition.steps[0], approvers: [{ type: "role", role_key: "missing_role" }] }],
    }
    expect((await request(await setup(), "admin", 1, "PUT", invalid)).status).toBe(422)
  })
})
