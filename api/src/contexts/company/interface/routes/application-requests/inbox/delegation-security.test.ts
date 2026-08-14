import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"

const jwtSecret = "inbox-delegation-security-test-secret"

async function setup() {
  const db = createD1TestDatabase(loadSchema())
  await seedD1(db, "employees", [
    { id: 2, code: "E002", name: "Approver", status: "active" },
    { id: 4, code: "E004", name: "Prior delegate", status: "active" },
    { id: 5, code: "E005", name: "Applicant", status: "active" },
    { id: 6, code: "E006", name: "Delegate", status: "active" },
  ])
  await seedIamForEmployees(db, [
    { id: 2, email: "you+e002@example.com", passwordHash: "hash", role: "member" },
    { id: 4, email: "you+e004@example.com", passwordHash: "hash", role: "member" },
    { id: 5, email: "you+e005@example.com", passwordHash: "hash", role: "member" },
    { id: 6, email: "you+e006@example.com", passwordHash: "hash", role: "member" },
  ])
  await seedD1(db, "application_templates", [
    {
      id: 500,
      code: "delegated_inbox",
      name: "Delegated inbox",
      category: "general",
      description: null,
      schema_json: "{}",
      approver_roles: "[]",
    },
  ])
  await seedD1(db, "application_requests", [
    {
      id: 500,
      template_id: 500,
      applicant_id: 5,
      status: "pending",
      current_step: "approval",
      payload: "{}",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ])
  const definition = JSON.stringify({
    version: 1,
    steps: [
      {
        key: "approval",
        name: "Approval",
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
      application_id: 500,
      definition_json: definition,
      current_step_key: "approval",
      current_round: 1,
      started_at: "2026-01-01T00:00:00.000Z",
      due_at: null,
    },
  ])
  await seedD1(db, "application_workflow_step_snapshots", [
    {
      application_id: 500,
      step_key: "approval",
      round: 1,
      required_approvals: 1,
      activated_at: "2026-01-01T00:00:00.000Z",
      due_at: null,
      escalated_at: null,
      resolution_reason: "activation",
      resolution_id: "delegated-inbox-resolution",
    },
  ])
  await seedD1(db, "application_workflow_step_candidates", [
    {
      application_id: 500,
      step_key: "approval",
      round: 1,
      candidate_employee_id: 2,
      candidate_account_id: 2,
      source: "primary",
      selectors_json: "[]",
      resolution_id: "delegated-inbox-resolution",
      eligible_from: null,
      resolved_at: "2026-01-01T00:00:00.000Z",
    },
  ])
  await seedD1(db, "approval_delegations", [
    {
      id: 500,
      delegator_employee_id: 2,
      delegate_employee_id: 6,
      template_code: "delegated_inbox",
      starts_at: "2026-01-01T00:00:00.000Z",
      ends_at: "2026-01-31T00:00:00.000Z",
      cancelled_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ])

  return db
}

async function inboxIds(db: D1Database, employeeId: number): Promise<Array<number>> {
  const token = await createTestToken(jwtSecret, { employeeId })
  const response = await requestWithContext({
    db,
    jwtSecret,
    path: "/application-requests/inbox",
    token,
    now: "2026-01-02T00:00:00.000Z",
  })
  const body = (await response.json()) as { data: Array<{ id: number }> }

  expect(response.status).toBe(200)
  return body.data.map((row) => row.id)
}

async function applicationInboxCount(db: D1Database, employeeId: number): Promise<number> {
  const token = await createTestToken(jwtSecret, { employeeId })
  const response = await requestWithContext({
    db,
    jwtSecret,
    path: "/inbox/counts",
    token,
    now: "2026-01-02T00:00:00.000Z",
  })
  const body = (await response.json()) as { applications: number }

  expect(response.status).toBe(200)
  return body.applications
}

describe("workflow delegation inbox security", () => {
  test("hides delegated work when the represented candidate is retired", async () => {
    const db = await setup()
    await db.prepare("UPDATE employees SET status = 'retired' WHERE id = 2").run()

    expect(await inboxIds(db, 6)).not.toContain(500)
  })

  test("hides delegated work when the frozen candidate account is inactive", async () => {
    const db = await setup()
    await db
      .prepare(
        `UPDATE accounts
         SET status = 'suspended', token_version = token_version + 1, updated_at = updated_at + 1
         WHERE id = 2`,
      )
      .run()

    expect(await inboxIds(db, 6)).not.toContain(500)
  })

  test("hides work from a candidate already represented in the round", async () => {
    const db = await setup()
    await seedD1(db, "application_workflow_approvals", [
      {
        application_id: 500,
        step_key: "approval",
        round: 1,
        approver_id: 4,
        approver_account_id: 4,
        represented_approver_id: 2,
        delegation_id: 500,
        action: "approve",
        comment: null,
        created_at: "2026-01-01T12:00:00.000Z",
      },
    ])

    expect(await inboxIds(db, 2)).not.toContain(500)
  })

  test("uses the same workflow eligibility for the inbox list and count", async () => {
    const db = await setup()

    expect([await inboxIds(db, 2), await applicationInboxCount(db, 2)]).toEqual([[500], 1])
    expect([await inboxIds(db, 6), await applicationInboxCount(db, 6)]).toEqual([[500], 1])
    expect([await inboxIds(db, 4), await applicationInboxCount(db, 4)]).toEqual([[], 0])
  })

  test("removes an already represented candidate from both the inbox list and count", async () => {
    const db = await setup()
    await seedD1(db, "application_workflow_approvals", [
      {
        application_id: 500,
        step_key: "approval",
        round: 1,
        approver_id: 4,
        approver_account_id: 4,
        represented_approver_id: 2,
        delegation_id: 500,
        action: "approve",
        comment: null,
        created_at: "2026-01-01T12:00:00.000Z",
      },
    ])

    expect([await inboxIds(db, 2), await applicationInboxCount(db, 2)]).toEqual([[], 0])
    expect([await inboxIds(db, 6), await applicationInboxCount(db, 6)]).toEqual([[], 0])
  })

  test("removes a returned workflow from both the inbox list and count", async () => {
    const db = await setup()
    await db
      .prepare("UPDATE application_requests SET current_step = 'returned:approval' WHERE id = 500")
      .run()

    expect([await inboxIds(db, 2), await applicationInboxCount(db, 2)]).toEqual([[], 0])
    expect([await inboxIds(db, 6), await applicationInboxCount(db, 6)]).toEqual([[], 0])
  })
})
