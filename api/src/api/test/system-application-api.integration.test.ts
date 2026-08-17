import { createCompanyProcedureDecisionPolicy } from "@/contexts/company-compatibility/domain/organization/company-procedure-decision-policy"
import { createTestToken } from "@/api/test/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
} from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { zAccountId } from "@system/domain/auth/account-id"
import { ProcedureDefinition } from "@system/domain/workflow/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/workflow/system-d1-procedure-repository"
import { describe, expect, test } from "bun:test"

const now = "2026-01-01T00:00:00.000Z"

async function token(employeeId: number): Promise<string> {
  return createTestToken(lifecycleRouteJwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
  })
}

async function createDb(): Promise<D1Database> {
  const db = await createLifecycleRouteDb()
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: {
      version: 1,
      steps: [
        {
          key: "manager_approval",
          name: "Manager approval",
          approvers: [{ type: "management_chain" }],
          approval_mode: "any",
          condition_mode: "all",
          conditions: [],
          due_days: null,
          escalation_approvers: [],
          rejection_behavior: "reject",
          allow_delegation: true,
        },
      ],
    },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinition.create({
    key: "system_test_request",
    revision: 1,
    title: "System test request",
    category: "test",
    description: "Exercises API composition over System and Company.",
    inputSchema: {
      fields: [
        {
          id: "reason",
          label: "Reason",
          type: "text",
          required: true,
          description: null,
          options: null,
        },
      ],
    },
    decisionPolicy: policy,
    completionOperationKey: null,
    createdByAccountId: zAccountId.parse("1"),
    createdAt: new Date(now),
  })
  if (definition instanceof Error) throw definition
  const published = await new SystemD1ProcedureRepository({ env: { DB: db } }).publish(
    definition,
    0,
  )
  if (published !== true) throw published

  return db
}

async function request(
  db: D1Database,
  employeeId: number,
  path: string,
  options: Readonly<{ method?: string; body?: unknown; at?: string }> = {},
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret: lifecycleRouteJwtSecret,
    path,
    method: options.method,
    body: options.body,
    token: await token(employeeId),
    now: options.at ?? now,
  })
}

async function submit(db: D1Database, reason: string): Promise<number> {
  const response = await request(db, 5, "/application-requests", {
    method: "POST",
    body: { template_code: "system_test_request", payload: { reason } },
  })
  expect(response.status).toBe(201)
  const body = await response.json()
  if (typeof body !== "object" || body === null || !("id" in body) || typeof body.id !== "number") {
    throw new Error("application ID is missing")
  }
  return body.id
}

describe("System application API composition", () => {
  test("publishes, submits, reads and approves without a request context", async () => {
    const db = await createDb()
    const templates = await request(db, 5, "/application-templates?category=test")
    expect(templates.status).toBe(200)
    expect(await templates.json()).toMatchObject({
      data: [{ code: "system_test_request", category: "test" }],
      total: 1,
    })

    const number = await submit(db, "Need a safe decision")
    const ownerDetail = await request(db, 5, `/application-requests/${number}`)
    expect(ownerDetail.status).toBe(200)
    expect(await ownerDetail.json()).toMatchObject({
      id: number,
      template_code: "system_test_request",
      status: "pending",
      payload: { reason: "Need a safe decision" },
    })
    expect((await request(db, 6, `/application-requests/${number}`)).status).toBe(403)

    const inbox = await request(db, 1, "/application-requests/inbox")
    expect(inbox.status).toBe(200)
    expect(await inbox.json()).toMatchObject({ data: [{ id: number, status: "pending" }] })
    const approved = await request(db, 1, `/application-requests/${number}/approve`, {
      method: "POST",
      body: { comment: "approved" },
      at: "2026-01-02T00:00:00.000Z",
    })
    expect(approved.status).toBe(200)
    expect(await approved.json()).toEqual({ status: "approved" })
    expect(
      await db
        .prepare(
          `SELECT workflow_case.status
           FROM system_cases workflow_case
           JOIN system_proposal_cases proposal_case ON proposal_case.case_id = workflow_case.id
           JOIN system_proposals proposal ON proposal.id = proposal_case.proposal_id
           JOIN system_proposal_numbers number ON number.series_id = proposal.series_id
           WHERE number.number = ?1`,
        )
        .bind(number)
        .first<string>("status"),
    ).toBe("approved")
  })

  test("freezes a proposal after candidate resolution and lets the owner withdraw it", async () => {
    const db = await createDb()
    const number = await submit(db, "first")
    const edited = await request(db, 5, `/application-requests/${number}`, {
      method: "PUT",
      body: { payload: { reason: "second" } },
      at: "2026-01-01T00:01:00.000Z",
    })
    expect(edited.status).toBe(409)
    expect(
      await db
        .prepare(
          `SELECT count(*) FROM system_proposals proposal
           JOIN system_proposal_numbers number ON number.series_id = proposal.series_id
           WHERE number.number = ?1`,
        )
        .bind(number)
        .first<number>("count(*)"),
    ).toBe(1)
    const withdrawn = await request(db, 5, `/application-requests/${number}`, {
      method: "DELETE",
      at: "2026-01-01T00:02:00.000Z",
    })
    expect(withdrawn.status).toBe(204)
    expect((await request(db, 5, `/application-requests/${number}`)).status).toBe(404)
  })

  test("creates a procedure-scoped System delegation through Company identity", async () => {
    const db = await createDb()
    const created = await request(db, 1, "/approval-delegations", {
      method: "POST",
      body: {
        delegate_employee_code: "E004",
        template_code: "system_test_request",
        starts_at: "2026-01-02T00:00:00.000Z",
        ends_at: "2026-01-03T00:00:00.000Z",
      },
    })
    expect(created.status).toBe(201)
    const body = await created.json()
    if (
      typeof body !== "object" ||
      body === null ||
      !("id" in body) ||
      typeof body.id !== "number"
    ) {
      throw new Error("delegation ID is missing")
    }
    const listed = await request(db, 1, "/approval-delegations")
    expect(listed.status).toBe(200)
    expect(await listed.json()).toMatchObject({
      data: [{ id: body.id, template_code: "system_test_request", can_delete: true }],
    })
    expect(
      (await db
        .prepare(
          `SELECT count(*) FROM system_delegation_procedure_scopes scope
             JOIN system_delegation_numbers number ON number.delegation_id = scope.delegation_id
             WHERE number.number = ?1 AND scope.procedure_key = 'system_test_request'`,
        )
        .bind(body.id)
        .first<number>("count(*)")) ?? 0,
    ).toBe(1)
    expect(
      (
        await request(db, 1, `/approval-delegations/${body.id}`, {
          method: "DELETE",
          at: "2026-01-01T00:01:00.000Z",
        })
      ).status,
    ).toBe(204)
  })

  test("accepts only one of two concurrent overlapping delegations", async () => {
    const db = await createDb()
    const input = {
      method: "POST",
      body: {
        delegate_employee_code: "E004",
        template_code: "system_test_request",
        starts_at: "2026-01-02T00:00:00.000Z",
        ends_at: "2026-01-03T00:00:00.000Z",
      },
    } as const

    const responses = await Promise.all([
      request(db, 1, "/approval-delegations", input),
      request(db, 1, "/approval-delegations", input),
    ])

    expect(
      responses.map((response) => response.status).sort((left, right) => left - right),
    ).toEqual([201, 409])
    expect(
      await db
        .prepare(
          `SELECT count(*) AS count
           FROM system_delegations
           WHERE delegator_account_id = '1' AND revoked_at IS NULL`,
        )
        .first<number>("count"),
    ).toBe(1)
  })
})
