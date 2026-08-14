import { app } from "@/api/app"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"

const jwtSecret = "workflow-repair-route-test-secret"
const applicationId = 501
const now = "2026-01-10T00:00:00.000Z"

const definition = JSON.stringify({
  version: 1,
  steps: [
    {
      key: "manager",
      name: "Manager approval",
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
})

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
  await seedD1(db, "application_templates", [
    {
      id: 50,
      code: "workflow_repair_test",
      name: "Workflow repair test",
      category: "general",
      description: null,
      schema_json: "{}",
      approver_roles: "[]",
    },
  ])
  await seedD1(db, "application_requests", [
    {
      id: applicationId,
      template_id: 50,
      applicant_id: 5,
      status: "pending",
      current_step: "manager",
      payload: "{}",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ])
  await seedD1(db, "application_workflow_instances", [
    {
      application_id: applicationId,
      definition_json: definition,
      current_step_key: "manager",
      current_round: 1,
      started_at: "2026-01-01T00:00:00.000Z",
      due_at: null,
    },
  ])
  return db
}

function token(employeeId: number) {
  return createTestToken(jwtSecret, { employeeId })
}

async function request(
  db: D1Database,
  path: string,
  employeeId: number | null,
  method: "GET" | "POST" = "GET",
  body?: unknown,
) {
  return app.request(
    path,
    {
      method,
      headers: {
        ...(employeeId === null ? {} : { Authorization: `Bearer ${await token(employeeId)}` }),
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

describe("workflow repair routes", () => {
  test("lists a missing current-step snapshot only for a global workflow administrator", async () => {
    const db = await setup()

    const response = await request(db, "/application-requests/workflow-repairs", 1)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: [
        {
          id: applicationId,
          template_code: "workflow_repair_test",
          template_name: "Workflow repair test",
          applicant_name: "Emery Lane",
          step_key: "manager",
          round: 1,
          reason: "snapshot_missing",
          started_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
    })

    expect((await request(db, "/application-requests/workflow-repairs", 2)).status).toBe(403)
    expect((await request(db, "/application-requests/workflow-repairs", null)).status).toBe(401)
  })

  test("paginates repair candidates while preserving the unfiltered total", async () => {
    const db = await setup()
    await seedD1(db, "application_requests", [
      {
        id: 502,
        template_id: 50,
        applicant_id: 6,
        status: "pending",
        current_step: "manager",
        payload: "{}",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ])
    await seedD1(db, "application_workflow_instances", [
      {
        application_id: 502,
        definition_json: definition,
        current_step_key: "manager",
        current_round: 1,
        started_at: "2026-01-02T00:00:00.000Z",
        due_at: null,
      },
    ])

    const response = await request(db, "/application-requests/workflow-repairs?limit=1&offset=1", 1)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: [{ id: 502 }], total: 2 })
  })

  test("lists a snapshot whose frozen primary candidates can no longer satisfy quorum", async () => {
    const db = await setup()
    await seedD1(db, "application_workflow_step_snapshots", [
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        required_approvals: 1,
        activated_at: "2026-01-01T00:00:00.000Z",
        resolution_reason: "activation",
        resolution_id: "inactive-candidate",
      },
    ])
    await seedD1(db, "application_workflow_step_candidates", [
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        candidate_employee_id: 18,
        candidate_account_id: 18,
        source: "primary",
        selectors_json: "[]",
        resolution_id: "inactive-candidate",
        resolved_at: "2026-01-01T00:00:00.000Z",
      },
    ])

    const response = await request(db, "/application-requests/workflow-repairs", 1)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: [{ id: applicationId, reason: "inactive_candidates" }],
      total: 1,
    })
  })

  test("does not flag a step when recorded votes plus active candidates can reach quorum", async () => {
    const db = await setup()
    await seedD1(db, "application_workflow_step_snapshots", [
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        required_approvals: 2,
        activated_at: "2026-01-01T00:00:00.000Z",
        resolution_reason: "activation",
        resolution_id: "partially-complete",
      },
    ])
    await seedD1(db, "application_workflow_step_candidates", [
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        candidate_employee_id: 2,
        candidate_account_id: 2,
        source: "primary",
        selectors_json: "[]",
        resolution_id: "partially-complete",
        resolved_at: "2026-01-01T00:00:00.000Z",
      },
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        candidate_employee_id: 3,
        candidate_account_id: 3,
        source: "primary",
        selectors_json: "[]",
        resolution_id: "partially-complete",
        resolved_at: "2026-01-01T00:00:00.000Z",
      },
    ])
    await seedD1(db, "application_workflow_approvals", [
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        approver_id: 2,
        approver_account_id: 2,
        represented_approver_id: 2,
        action: "approve",
        comment: null,
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ])
    await db.prepare("UPDATE employees SET status = 'retired' WHERE id = 2").run()

    const response = await request(db, "/application-requests/workflow-repairs", 1)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [], total: 0 })
  })

  test("activates a due escalation before classifying the step as repairable", async () => {
    const db = await setup()
    await seedD1(db, "application_workflow_step_snapshots", [
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        required_approvals: 1,
        activated_at: "2026-01-01T00:00:00.000Z",
        due_at: "2026-01-05T00:00:00.000Z",
        resolution_reason: "activation",
        resolution_id: "due-escalation",
      },
    ])
    await seedD1(db, "application_workflow_step_candidates", [
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        candidate_employee_id: 18,
        candidate_account_id: 18,
        source: "primary",
        selectors_json: "[]",
        resolution_id: "due-escalation",
        resolved_at: "2026-01-01T00:00:00.000Z",
      },
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        candidate_employee_id: 2,
        candidate_account_id: 2,
        source: "escalation",
        selectors_json: "[]",
        resolution_id: "due-escalation",
        eligible_from: "2026-01-05T00:00:00.000Z",
        resolved_at: "2026-01-01T00:00:00.000Z",
      },
    ])

    const response = await request(db, "/application-requests/workflow-repairs", 1)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [], total: 0 })
    expect(
      await db
        .prepare(
          `SELECT escalated_at FROM application_workflow_step_snapshots
           WHERE application_id = ?1 AND step_key = 'manager' AND round = 1`,
        )
        .bind(applicationId)
        .first<string>("escalated_at"),
    ).toBe(now)
  })

  test("rejects reassignment when the first post-deadline request activates a reachable escalation", async () => {
    const db = await setup()
    await seedD1(db, "application_workflow_step_snapshots", [
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        required_approvals: 1,
        activated_at: "2026-01-01T00:00:00.000Z",
        due_at: "2026-01-05T00:00:00.000Z",
        resolution_reason: "activation",
        resolution_id: "due-reassign",
      },
    ])
    await seedD1(db, "application_workflow_step_candidates", [
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        candidate_employee_id: 18,
        candidate_account_id: 18,
        source: "primary",
        selectors_json: "[]",
        resolution_id: "due-reassign",
        resolved_at: "2026-01-01T00:00:00.000Z",
      },
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        candidate_employee_id: 2,
        candidate_account_id: 2,
        source: "escalation",
        selectors_json: "[]",
        resolution_id: "due-reassign",
        eligible_from: "2026-01-05T00:00:00.000Z",
        resolved_at: "2026-01-01T00:00:00.000Z",
      },
    ])

    const response = await request(
      db,
      `/application-requests/${applicationId}/reassign-workflow-step`,
      1,
      "POST",
      { candidate_employee_ids: [3], reason: "Do not bypass escalation" },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "workflow_not_repairable" })
  })

  test("requires an explicit audited quorum when an all-approval snapshot is missing", async () => {
    const db = await setup()
    const allDefinition = JSON.stringify({
      ...JSON.parse(definition),
      steps: [{ ...JSON.parse(definition).steps[0], approval_mode: "all" }],
    })
    await db
      .prepare(
        "UPDATE application_workflow_instances SET definition_json = ?2 WHERE application_id = ?1",
      )
      .bind(applicationId, allDefinition)
      .run()
    const path = `/application-requests/${applicationId}/reassign-workflow-step`

    const missingQuorum = await request(db, path, 1, "POST", {
      candidate_employee_ids: [2, 3],
      reason: "Replace unavailable all-approval group",
    })
    expect(missingQuorum.status).toBe(422)
    expect(await missingQuorum.json()).toMatchObject({ code: "workflow_quorum_required" })

    const repaired = await request(db, path, 1, "POST", {
      candidate_employee_ids: [2, 3],
      required_approvals: 2,
      reason: "Replace unavailable all-approval group",
    })
    expect(repaired.status).toBe(200)
    const event = await db
      .prepare(
        "SELECT details_json FROM application_workflow_events WHERE event_type = 'reassigned'",
      )
      .first<string>("details_json")
    expect(JSON.parse(event ?? "{}")).toMatchObject({
      required_approvals: 2,
      quorum_override: true,
    })
  })

  test("starts a new audited round without deleting prior decisions", async () => {
    const db = await setup()
    await seedD1(db, "application_workflow_approvals", [
      {
        application_id: applicationId,
        step_key: "manager",
        round: 1,
        approver_id: 4,
        represented_approver_id: 4,
        action: "return",
        comment: "Previous decision",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ])

    const response = await request(
      db,
      `/application-requests/${applicationId}/reassign-workflow-step`,
      1,
      "POST",
      { candidate_employee_ids: [2], reason: "The original approver is unavailable" },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: "pending",
      step_key: "manager",
      round: 2,
      candidate_employee_ids: [2],
    })
    expect(
      await db
        .prepare(
          `SELECT resolution_reason, required_approvals
           FROM application_workflow_step_snapshots
           WHERE application_id = ?1 AND step_key = 'manager' AND round = 2`,
        )
        .bind(applicationId)
        .first(),
    ).toMatchObject({ resolution_reason: "manual_repair", required_approvals: 1 })
    expect(
      await db
        .prepare(
          `SELECT candidate_employee_id, candidate_account_id
           FROM application_workflow_step_candidates
           WHERE application_id = ?1 AND step_key = 'manager' AND round = 2`,
        )
        .bind(applicationId)
        .first<{ candidate_employee_id: number; candidate_account_id: number }>(),
    ).toEqual({ candidate_employee_id: 2, candidate_account_id: 2 })
    expect(
      await db
        .prepare(
          "SELECT event_type, actor_account_id, details_json FROM application_workflow_events",
        )
        .first(),
    ).toMatchObject({ event_type: "reassigned", actor_account_id: 1 })
    expect(
      await db
        .prepare("SELECT COUNT(*) AS total FROM application_workflow_approvals WHERE round = 1")
        .first<number>("total"),
    ).toBe(1)
  })

  test("rejects unauthorized, self, invalid and already-decided repairs", async () => {
    const db = await setup()
    const path = `/application-requests/${applicationId}/reassign-workflow-step`
    const validBody = { candidate_employee_ids: [2], reason: "Manual recovery" }

    expect((await request(db, path, null, "POST", validBody)).status).toBe(401)
    expect((await request(db, path, 2, "POST", validBody)).status).toBe(403)
    expect(
      (
        await request(db, path, 1, "POST", {
          candidate_employee_ids: [5],
          reason: "Manual recovery",
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await request(db, path, 1, "POST", {
          candidate_employee_ids: [18],
          reason: "Manual recovery",
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await request(db, path, 1, "POST", {
          candidate_employee_ids: [2],
          reason: "   ",
        })
      ).status,
    ).toBe(400)

    await db
      .prepare(
        "UPDATE application_requests SET status = 'approved', current_step = NULL WHERE id = ?1",
      )
      .bind(applicationId)
      .run()
    expect((await request(db, path, 1, "POST", validBody)).status).toBe(409)
  })
})
