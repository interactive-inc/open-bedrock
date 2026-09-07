import { withCurrentDecisionTarget } from "@tests/api/support/with-current-decision-target"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { createTestToken } from "@tests/api/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
} from "@tests/api/support/lifecycle-route-fixture"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { describe, expect, spyOn, test } from "bun:test"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"

const now = "2026-01-01T00:00:00.000Z"

async function token(employeeId: EmployeeId): Promise<string> {
  return createTestToken(lifecycleRouteJwtSecret, {
    employeeId,
  })
}

async function createDb(
  options?: Parameters<typeof createLifecycleRouteDb>[0],
  stepOverrides: Partial<ApplicationWorkflowStep> = {},
  extraSteps: ReadonlyArray<ApplicationWorkflowStep> = [],
): Promise<D1Database> {
  const db = await createLifecycleRouteDb(options)
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
          ...stepOverrides,
        },
        ...extraSteps,
      ],
    },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
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
  employeeId: EmployeeId,
  path: string,
  options: Readonly<{ method?: string; body?: unknown; at?: string }> = {},
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret: lifecycleRouteJwtSecret,
    path,
    method: options.method,
    body: await withCurrentDecisionTarget(db, path, options.body),
    token: await token(employeeId),
    now: options.at ?? now,
  })
}

async function submit(db: D1Database, reason: string): Promise<number> {
  const response = await request(db, toWorkforceEmployeeId(5), "/company/application-requests", {
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
  test.each([
    ["approve", "Changed after review"],
    ["reject", "Changed after review"],
    ["approve", "Viewed content"],
  ])("閲覧後に改訂された提案へ古い画面の判断を付けない: %s, %s", async (action, reason) => {
    const db = await createDb(undefined, { rejection_behavior: "return" })
    const number = await submit(db, "Viewed content")
    const seen = await new SystemD1ProposalAdapter({ env: { DB: db } }).findByNumber(number)
    if (seen === null || seen instanceof Error) throw new Error("proposal is missing")
    const target = {
      proposal_version: seen.version,
      proposal_digest: seen.digest,
      task_key: seen.lastTaskKey,
      task_round: seen.lastTaskRound,
    }
    const viewed = await request(
      db,
      toWorkforceEmployeeId(1),
      `/company/application-requests/${number}`,
    )
    expect(await viewed.json()).toMatchObject({
      decision_target: target,
      payload: { reason: "Viewed content" },
      can_decide: true,
    })
    expect(
      (
        await request(
          db,
          toWorkforceEmployeeId(1),
          `/company/application-requests/${number}/reject`,
          {
            method: "POST",
            body: { comment: "Please revise", decision_target: target },
          },
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await request(
          db,
          toWorkforceEmployeeId(5),
          `/company/application-requests/${number}/resubmit`,
          {
            method: "POST",
            body: { payload: { reason } },
          },
        )
      ).status,
    ).toBe(200)
    const response = await request(
      db,
      toWorkforceEmployeeId(1),
      `/company/application-requests/${number}/${action}`,
      {
        method: "POST",
        body: { comment: "Decision about viewed content", decision_target: target },
      },
    )
    expect(response.status).toBe(409)
    expect(
      await db
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(1)
  })

  test("内容を見た参照が欠けている場合や段階・round・digestが違う場合は判断しない", async () => {
    const db = await createDb()
    const number = await submit(db, "Exact decision target")
    const seen = await new SystemD1ProposalAdapter({ env: { DB: db } }).findByNumber(number)
    if (seen === null || seen instanceof Error) throw new Error("proposal is missing")
    const target = {
      proposal_version: seen.version,
      proposal_digest: seen.digest,
      task_key: seen.lastTaskKey,
      task_round: seen.lastTaskRound,
    }
    for (const action of ["approve", "reject"]) {
      expect(
        (
          await request(
            db,
            toWorkforceEmployeeId(1),
            `/company/application-requests/${number}/${action}`,
            {
              method: "POST",
              body: { comment: "Decision", decision_target: undefined },
            },
          )
        ).status,
      ).toBe(400)
      for (const changed of [
        { ...target, proposal_digest: "b".repeat(64) },
        { ...target, task_key: "another-step" },
        { ...target, task_round: 2 },
      ]) {
        expect(
          (
            await request(
              db,
              toWorkforceEmployeeId(1),
              `/company/application-requests/${number}/${action}`,
              {
                method: "POST",
                body: { comment: "Decision", decision_target: changed },
              },
            )
          ).status,
        ).toBe(409)
      }
    }
    expect(
      await db
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(0)
  })

  test("同じ提案でも前段階の承認再送を次段階の承認に変換しない", async () => {
    const db = await createDb(undefined, {}, [
      {
        key: "final_approval",
        name: "Final approval",
        approvers: [{ type: "management_chain" }],
        approval_mode: "any",
        condition_mode: "all",
        conditions: [],
        due_days: null,
        escalation_approvers: [],
        rejection_behavior: "reject",
        allow_delegation: true,
      },
    ])
    const number = await submit(db, "Two separate decisions")
    const seen = await new SystemD1ProposalAdapter({ env: { DB: db } }).findByNumber(number)
    if (seen === null || seen instanceof Error) throw new Error("proposal is missing")
    const body = {
      comment: "First stage",
      decision_target: {
        proposal_version: seen.version,
        proposal_digest: seen.digest,
        task_key: seen.lastTaskKey,
        task_round: seen.lastTaskRound,
      },
    }
    const path = `/company/application-requests/${number}/approve`
    expect(
      (await request(db, toWorkforceEmployeeId(1), path, { method: "POST", body })).status,
    ).toBe(200)
    expect(
      (await request(db, toWorkforceEmployeeId(1), path, { method: "POST", body })).status,
    ).toBe(409)
    expect(
      await db
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(1)
    expect(
      (
        await request(db, toWorkforceEmployeeId(1), path, {
          method: "POST",
          body: { comment: "Final stage" },
        })
      ).status,
    ).toBe(200)
    expect(
      await db
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(2)
  })

  test("対象の照合後に差戻し・再提出が競合しても新しい版へ判断を付けない", async () => {
    const db = await createDb(undefined, { rejection_behavior: "return" })
    const number = await submit(db, "Concurrent revision")
    const interception = spyOn(SystemD1WorkflowAdapter.prototype, "decide").mockImplementationOnce(
      async function (this: SystemD1WorkflowAdapter, command) {
        interception.mockRestore()
        expect(
          (
            await request(
              db,
              toWorkforceEmployeeId(1),
              `/company/application-requests/${number}/reject`,
              {
                method: "POST",
                body: { comment: "Revise before deciding" },
              },
            )
          ).status,
        ).toBe(200)
        expect(
          (
            await request(
              db,
              toWorkforceEmployeeId(5),
              `/company/application-requests/${number}/resubmit`,
              {
                method: "POST",
                body: { payload: { reason: "Concurrent replacement" } },
              },
            )
          ).status,
        ).toBe(200)
        return this.decide(command)
      },
    )
    try {
      expect(
        (
          await request(
            db,
            toWorkforceEmployeeId(1),
            `/company/application-requests/${number}/approve`,
            {
              method: "POST",
              body: { comment: "Old proposal" },
            },
          )
        ).status,
      ).toBe(409)
    } finally {
      interception.mockRestore()
    }
    expect(
      await db
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(1)
    const latest = await new SystemD1ProposalAdapter({ env: { DB: db } }).findByNumber(number)
    expect(latest).toMatchObject({ version: 2, status: "pending" })
  })

  test("在籍を続けていても、提出後に失った上司資格では承認できない", async () => {
    const db = await createDb({ subjectAssignmentEndsOn: "2026-01-02" })
    const number = await submit(db, "Authority must still apply at the decision")
    const response = await request(
      db,
      toWorkforceEmployeeId(1),
      `/company/application-requests/${number}/approve`,
      {
        method: "POST",
        body: { comment: "Former manager" },
        at: "2026-01-02T00:00:00.000Z",
      },
    )
    expect(response.status).toBe(403)
    expect(
      await db
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(0)
  })
  test.each(["approve", "reject"])(
    "委任元の上司資格が失効した場合は代理判断も拒否する: %s",
    async (action) => {
      const db = await createDb({ subjectAssignmentEndsOn: "2026-01-02" })
      const created = await request(db, toWorkforceEmployeeId(1), "/company/approval-delegations", {
        method: "POST",
        body: {
          delegate_employee_code: "E002",
          template_code: "system_test_request",
          starts_at: "2026-01-01T00:00:00.000Z",
          ends_at: "2026-01-03T00:00:00.000Z",
        },
      })
      expect(created.status).toBe(201)
      const number = await submit(db, "Delegation does not preserve expired authority")
      const response = await request(
        db,
        toWorkforceEmployeeId(2),
        `/company/application-requests/${number}/${action}`,
        {
          method: "POST",
          body: { comment: "Delegated decision" },
          at: "2026-01-02T00:00:00.000Z",
        },
      )
      expect(response.status).toBe(403)
      expect(
        await db
          .prepare("SELECT count(*) AS total FROM system_human_attestations")
          .first<number>("total"),
      ).toBe(0)
    },
  )

  test("資格が有効な委任元の代理承認は保存できる", async () => {
    const db = await createDb()
    expect(
      (
        await request(db, toWorkforceEmployeeId(1), "/company/approval-delegations", {
          method: "POST",
          body: {
            delegate_employee_code: "E002",
            template_code: "system_test_request",
            starts_at: now,
            ends_at: "2026-01-03T00:00:00.000Z",
          },
        })
      ).status,
    ).toBe(201)
    const number = await submit(db, "Valid delegated approval")
    expect(
      (
        await request(
          db,
          toWorkforceEmployeeId(2),
          `/company/application-requests/${number}/approve`,
          {
            method: "POST",
            body: { comment: null },
            at: "2026-01-02T00:00:00.000Z",
          },
        )
      ).status,
    ).toBe(200)
    expect(
      await db
        .prepare("SELECT actor_account_id, represented_account_id FROM system_human_attestations")
        .first<{ actor_account_id: string; represented_account_id: string }>(),
    ).toEqual({
      actor_account_id: "2",
      represented_account_id: "1",
    })
  })

  test.each([
    { accountId: "1", change: "missing" },
    { accountId: "2", change: "missing" },
    { accountId: "1", change: "future" },
    { accountId: "2", change: "future" },
  ])(
    "代理判断の保存直前に人のPrincipalが変わった場合は全体を取り消す: %j",
    async ({ accountId, change }) => {
      const db = await createDb(undefined, {
        approvers: [{ type: "employee", employee_code: "E001" }],
      })
      const delegation = await request(
        db,
        toWorkforceEmployeeId(1),
        "/company/approval-delegations",
        {
          method: "POST",
          body: {
            delegate_employee_code: "E002",
            template_code: "system_test_request",
            starts_at: now,
            ends_at: "2026-01-03T00:00:00.000Z",
          },
        },
      )
      expect(delegation.status).toBe(201)
      const number = await submit(db, "Human identity must remain valid until persistence")
      const interception = spyOn(
        SystemD1WorkflowAdapter.prototype,
        "decide",
      ).mockImplementationOnce(async function (this: SystemD1WorkflowAdapter, input) {
        interception.mockRestore()
        if (change === "missing") {
          await db
            .prepare("DELETE FROM system_principals WHERE account_id = ?1")
            .bind(accountId)
            .run()
        } else {
          await db
            .prepare(`UPDATE system_principals SET created_at = ?2, updated_at = ?2,
              revision = revision + 1 WHERE account_id = ?1`)
            .bind(accountId, new Date(now).getTime() + 1)
            .run()
        }
        return this.decide(input)
      })
      try {
        const response = await request(
          db,
          toWorkforceEmployeeId(2),
          `/company/application-requests/${number}/approve`,
          { method: "POST", body: { comment: null } },
        )
        expect(response.status).toBe(409)
      } finally {
        interception.mockRestore()
      }
      expect(
        await db
          .prepare("SELECT count(*) AS total FROM system_human_attestations")
          .first<number>("total"),
      ).toBe(0)
      expect(await db.prepare("SELECT status FROM system_cases").first<string>("status")).toBe(
        "pending",
      )
      expect(
        await db.prepare("SELECT outcome FROM system_decision_tasks").first<string>("outcome"),
      ).toBeNull()
    },
  )

  test("再検査時も提出時の期限を保ち、期限後の追加候補だけを許可する", async () => {
    const db = await createDb(undefined, {
      due_days: 1,
      escalation_approvers: [{ type: "employee", employee_code: "E002" }],
    })
    const number = await submit(db, "Escalation keeps its original deadline")
    const path = `/company/application-requests/${number}/approve`
    expect(
      (
        await request(db, toWorkforceEmployeeId(2), path, {
          method: "POST",
          body: { comment: null },
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await request(db, toWorkforceEmployeeId(2), path, {
          method: "POST",
          body: { comment: null },
          at: "2026-01-02T00:00:00.000Z",
        })
      ).status,
    ).toBe(200)
  })

  test("資格の再検査後に条件の従業員番号が変わると判断全体を取り消す", async () => {
    const db = await createDb(undefined, {
      approvers: [{ type: "employee", employee_code: "E001" }],
    })
    const number = await submit(db, "Revalidation and persistence must use the same facts")
    const interception = spyOn(SystemD1WorkflowAdapter.prototype, "decide").mockImplementationOnce(
      async function (this: SystemD1WorkflowAdapter, input) {
        interception.mockRestore()
        await db
          .prepare("UPDATE company_employees SET employee_code = 'RENAMED' WHERE id = '1'")
          .run()
        return this.decide(input)
      },
    )
    try {
      expect(
        (
          await request(
            db,
            toWorkforceEmployeeId(1),
            `/company/application-requests/${number}/approve`,
            {
              method: "POST",
              body: { comment: null },
            },
          )
        ).status,
      ).toBe(409)
    } finally {
      interception.mockRestore()
    }
    expect(
      await db
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(0)
    expect(await db.prepare("SELECT status FROM system_cases").first<string>("status")).toBe(
      "pending",
    )
    expect(
      await db.prepare("SELECT outcome FROM system_decision_tasks").first<string>("outcome"),
    ).toBeNull()
  })

  test("資格再検査後の休職は組織版が変わらなくても判断を取り消す", async () => {
    const db = await createDb()
    const number = await submit(db, "Employment status must stay valid until persistence")
    const revision = await db
      .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
      .first<number>("revision")
    const interception = spyOn(SystemD1WorkflowAdapter.prototype, "decide").mockImplementationOnce(
      async function (this: SystemD1WorkflowAdapter, input) {
        interception.mockRestore()
        await db
          .prepare(`INSERT INTO company_employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at)
        SELECT period_id, revision + 1, employment_period_id, employee_id, 'leave', starts_on,
          ends_on, is_void, recorded_by_action_id, recorded_at + 1
        FROM company_employee_status_period_versions WHERE employee_id = '1'`)
          .run()
        return this.decide(input)
      },
    )
    try {
      expect(
        (
          await request(
            db,
            toWorkforceEmployeeId(1),
            `/company/application-requests/${number}/approve`,
            {
              method: "POST",
              body: { comment: null },
            },
          )
        ).status,
      ).toBe(409)
    } finally {
      interception.mockRestore()
    }
    expect(
      await db
        .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
        .first<number>("revision"),
    ).toBe(revision)
    expect(
      await db
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(0)
    expect(await db.prepare("SELECT status FROM system_cases").first<string>("status")).toBe(
      "pending",
    )
  })

  test("publishes, submits, reads and approves without a request context", async () => {
    const db = await createDb()
    const templates = await request(
      db,
      toWorkforceEmployeeId(5),
      "/company/application-templates?category=test",
    )
    expect(templates.status).toBe(200)
    expect(await templates.json()).toMatchObject({
      data: [{ code: "system_test_request", category: "test" }],
      total: 1,
    })

    const number = await submit(db, "Need a safe decision")
    const ownerDetail = await request(
      db,
      toWorkforceEmployeeId(5),
      `/company/application-requests/${number}`,
    )
    expect(ownerDetail.status).toBe(200)
    expect(await ownerDetail.json()).toMatchObject({
      id: number,
      template_code: "system_test_request",
      status: "pending",
      payload: { reason: "Need a safe decision" },
    })
    expect(
      (await request(db, toWorkforceEmployeeId(6), `/company/application-requests/${number}`))
        .status,
    ).toBe(403)

    const inbox = await request(db, toWorkforceEmployeeId(1), "/company/application-requests/inbox")
    expect(inbox.status).toBe(200)
    expect(await inbox.json()).toMatchObject({ data: [{ id: number, status: "pending" }] })
    const approved = await request(
      db,
      toWorkforceEmployeeId(1),
      `/company/application-requests/${number}/approve`,
      {
        method: "POST",
        body: { comment: "approved" },
        at: "2026-01-02T00:00:00.000Z",
      },
    )
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
    const edited = await request(
      db,
      toWorkforceEmployeeId(5),
      `/company/application-requests/${number}`,
      {
        method: "PUT",
        body: { payload: { reason: "second" } },
        at: "2026-01-01T00:01:00.000Z",
      },
    )
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
    const withdrawn = await request(
      db,
      toWorkforceEmployeeId(5),
      `/company/application-requests/${number}`,
      {
        method: "DELETE",
        at: "2026-01-01T00:02:00.000Z",
      },
    )
    expect(withdrawn.status).toBe(204)
    expect(
      (await request(db, toWorkforceEmployeeId(5), `/company/application-requests/${number}`))
        .status,
    ).toBe(404)
  })

  test("creates a procedure-scoped System delegation through Company identity", async () => {
    const db = await createDb()
    const created = await request(db, toWorkforceEmployeeId(1), "/company/approval-delegations", {
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
    const listed = await request(db, toWorkforceEmployeeId(1), "/company/approval-delegations")
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
        await request(db, toWorkforceEmployeeId(1), `/company/approval-delegations/${body.id}`, {
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
      request(db, toWorkforceEmployeeId(1), "/company/approval-delegations", input),
      request(db, toWorkforceEmployeeId(1), "/company/approval-delegations", input),
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
