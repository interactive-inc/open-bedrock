import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"

const jwtSecret = "personnel-action-request-route-test-secret"
const idempotencyKey = "22345678-1234-4abc-8def-1234567890ab"
const body = {
  action: {
    kind: "leave_started" as const,
    employeeCode: "E003",
    eventOn: "2026-01-01",
  },
  base_employee_revision: 0,
  base_organization_revision: null,
}

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await initializeStandardCompanyTestState(db)
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
  const definition = ProcedureDefinitionEntity.create({
    key: "personnel_action_request",
    revision: 1,
    title: "Personnel action request",
    category: "company",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "company.personnel-action.apply",
    createdByAccountId: zAccountId.parse("1"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  })
  if (definition instanceof Error) throw definition
  const published = await new SystemD1ProcedureRepository({ env: { DB: db } }).publish(
    definition,
    0,
  )
  if (published !== true) throw published
  return db
}

async function post(
  db: D1Database,
  requestBody: typeof body,
  key: string | null = idempotencyKey,
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/company/personnel-action-requests",
    token: await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) }),
    method: "POST",
    body: requestBody,
    headers: key === null ? {} : { "Idempotency-Key": key },
  })
}

async function countById(db: D1Database, table: string): Promise<number> {
  return (
    (await db
      .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE id = ?1`)
      .bind(idempotencyKey)
      .first<number>("count")) ?? 0
  )
}

describe("POST /company/personnel-action-requests", () => {
  test("starts one System procedure and replays the same Company request", async () => {
    const db = await createTestDb()

    const created = await post(db, body)
    const replayed = await post(db, body)
    const createdBody = await created.json()
    const replayedBody = await replayed.json()

    expect({ status: created.status, body: createdBody }).toMatchObject({
      status: 201,
      body: { id: idempotencyKey, replayed: false },
    })
    expect({ status: replayed.status, body: replayedBody }).toMatchObject({
      status: 200,
      body: { id: idempotencyKey, replayed: true },
    })
    expect(await countById(db, "company_personnel_action_requests")).toBe(1)
    expect(await countById(db, "system_proposal_series")).toBe(1)
  })

  test("rejects reuse of the key with a different request", async () => {
    const db = await createTestDb()
    expect((await post(db, body)).status).toBe(201)

    const response = await post(db, {
      ...body,
      action: { ...body.action, eventOn: "2026-01-02" },
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "idempotency_conflict" })
    expect(await countById(db, "company_personnel_action_requests")).toBe(1)
  })

  test("requires a UUID idempotency key before persistence", async () => {
    const db = await createTestDb()

    expect((await post(db, body, null)).status).toBe(400)
    expect((await post(db, body, "not-a-uuid")).status).toBe(400)
    expect(await countById(db, "company_personnel_action_requests")).toBe(0)
  })
})
