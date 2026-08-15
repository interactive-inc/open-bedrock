import { DecideApplication } from "@/contexts/request/application/decide-application"
import { SubmitApplication } from "@/contexts/request/application/submit-application"
import { ApplicationTemplate } from "@/contexts/request/domain/application-template.entity"
import type { ApplicationWorkflow } from "@/contexts/request/domain/application-workflow"
import { ApplicationTemplateRepository } from "@/contexts/request/infrastructure/application-template-repository"
import { ApplicationWorkflowRepository } from "@/contexts/request/infrastructure/application-workflow-repository"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import { makeTestSession } from "@/contexts/company/interface/test-helpers/make-test-session"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { describe, expect, test } from "bun:test"
import { zAccountId } from "@system/domain/auth/account-id"

const approvalStep = {
  key: "approval",
  name: "Approval",
  approvers: [{ type: "employee" as const, employee_code: "E002" }],
  approval_mode: "any" as const,
  condition_mode: "all" as const,
  conditions: [],
  due_days: null,
  escalation_approvers: [],
  rejection_behavior: "reject" as const,
  allow_delegation: true,
}

async function setup(workflow: ApplicationWorkflow) {
  const { context, db } = createTestContext()
  await seedD1(db, "employees", [
    { id: 2, code: "E002", name: "Approver A", status: "active" },
    { id: 3, code: "E003", name: "Approver B", status: "active" },
    { id: 4, code: "E004", name: "Delegate A", status: "active" },
    { id: 5, code: "E005", name: "Applicant", status: "active" },
    { id: 6, code: "E006", name: "Delegate B", status: "active" },
  ])
  await seedD1(db, "accounts", [
    { id: 1, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    { id: 2, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    { id: 3, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    { id: 4, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    { id: 6, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
  ])
  await seedD1(db, "account_employee_links", [
    { account_id: 2, employee_id: 2 },
    { account_id: 3, employee_id: 3 },
    { account_id: 4, employee_id: 4 },
    { account_id: 6, employee_id: 6 },
  ])

  const template = await new ApplicationTemplateRepository(context).create(
    ApplicationTemplate.create({
      code: "delegation_security",
      name: "Delegation security",
      category: "general",
      description: null,
      schemaJson: {},
      approverRoles: [],
    }),
  )
  if (template instanceof Error || template.id === null) throw template

  const workflowRepository = new ApplicationWorkflowRepository(context)
  const saved = await workflowRepository.saveDefinition({
    templateId: template.id,
    definition: workflow,
    expectedRevision: 0,
    updatedByAccountId: zAccountId.parse("1"),
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
  if (saved instanceof Error) throw saved

  const application = await new SubmitApplication(context).run({
    applicantId: 5,
    templateCode: "delegation_security",
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  })
  if (application instanceof Error || application.id === null) throw application

  return { context, db, applicationId: application.id }
}

function decide(
  context: Awaited<ReturnType<typeof setup>>["context"],
  applicationId: number,
  employeeId: number,
  action: "approve" | "reject" = "approve",
) {
  return new DecideApplication(context).run({
    session: makeTestSession("member", employeeId),
    applicationId,
    approverId: employeeId,
    action,
    comment: null,
    createdAt: "2026-01-02T00:00:00.000Z",
  })
}

async function seedDelegation(
  db: D1Database,
  props: { id: number; delegatorEmployeeId?: number; delegateEmployeeId?: number },
) {
  await seedD1(db, "approval_delegations", [
    {
      id: props.id,
      delegator_employee_id: props.delegatorEmployeeId ?? 2,
      delegate_employee_id: props.delegateEmployeeId ?? 4,
      template_code: "delegation_security",
      starts_at: "2026-01-01T00:00:00.000Z",
      ends_at: "2026-01-31T00:00:00.000Z",
      cancelled_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ])
}

function pauseMatchingAllQueriesUntilBothArrive(db: D1Database, pattern: string): D1Database {
  let arrivals = 0
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  const wrapStatement = (statement: D1PreparedStatement, query: string): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, property, receiver) {
        if (property === "bind") {
          return (...values: Array<unknown>) => wrapStatement(target.bind(...values), query)
        }
        if (property === "all" && query.includes(pattern)) {
          return async () => {
            arrivals += 1
            if (arrivals === 2) release?.()
            await gate
            return target.all()
          }
        }

        return Reflect.get(target, property, receiver)
      },
    })

  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === "prepare") {
        return (query: string) => wrapStatement(target.prepare(query), query)
      }

      return Reflect.get(target, property, receiver)
    },
  })
}

function beforeNextBatch(db: D1Database, mutate: () => Promise<unknown>): D1Database {
  let pending = true

  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === "batch") {
        return async (statements: Array<D1PreparedStatement>) => {
          if (pending) {
            pending = false
            await mutate()
          }
          return target.batch(statements)
        }
      }

      return Reflect.get(target, property, receiver)
    },
  })
}

async function expectNoApproval(
  result: Awaited<ReturnType<typeof decide>>,
  db: D1Database,
  applicationId: number,
) {
  expect(result).toBeInstanceOf(Error)
  const approvalCount = await db
    .prepare(
      "SELECT COUNT(*) AS total FROM application_workflow_approvals WHERE application_id = ?1",
    )
    .bind(applicationId)
    .first<number>("total")
  const status = await db
    .prepare("SELECT status FROM application_requests WHERE id = ?1")
    .bind(applicationId)
    .first<string>("status")

  expect([approvalCount, status]).toEqual([0, "pending"])
}

describe("workflow delegation security", () => {
  test("does not let a represented candidate decide again directly", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...approvalStep,
          approval_mode: "minimum",
          minimum_approvals: 2,
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
          ],
        },
      ],
    })
    await seedDelegation(setupResult.db, { id: 10 })

    expect(await decide(setupResult.context, setupResult.applicationId, 4)).toEqual({
      status: "pending",
    })

    const repeated = await decide(setupResult.context, setupResult.applicationId, 2, "reject")
    const status = await setupResult.db
      .prepare("SELECT status FROM application_requests WHERE id = ?1")
      .bind(setupResult.applicationId)
      .first<string>("status")
    const approvalCount = await setupResult.db
      .prepare(
        "SELECT COUNT(*) AS total FROM application_workflow_approvals WHERE application_id = ?1",
      )
      .bind(setupResult.applicationId)
      .first<number>("total")

    expect(repeated).toMatchObject({ code: "forbidden" })
    expect([status, approvalCount]).toEqual(["pending", 1])
  })

  test("lets only one actor represent a candidate when delegated votes race", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...approvalStep,
          approval_mode: "minimum",
          minimum_approvals: 2,
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
          ],
        },
      ],
    })
    await seedDelegation(setupResult.db, { id: 20, delegateEmployeeId: 4 })
    await seedDelegation(setupResult.db, { id: 21, delegateEmployeeId: 6 })
    setupResult.context.env.DB = pauseMatchingAllQueriesUntilBothArrive(
      setupResult.context.env.DB,
      "SELECT DISTINCT approval.represented_approver_id",
    )

    const results = await Promise.all([
      decide(setupResult.context, setupResult.applicationId, 4),
      decide(setupResult.context, setupResult.applicationId, 6),
    ])
    const approvals = await setupResult.db
      .prepare(
        `SELECT approver_id, represented_approver_id
         FROM application_workflow_approvals
         WHERE application_id = ?1`,
      )
      .bind(setupResult.applicationId)
      .all<{ approver_id: number; represented_approver_id: number }>()

    expect(results.filter((result) => result instanceof Error)).toHaveLength(1)
    expect(approvals.results).toHaveLength(1)
    expect(approvals.results[0]?.represented_approver_id).toBe(2)
  })

  const delegationMutations = [
    {
      name: "cancellation",
      sql: "UPDATE approval_delegations SET cancelled_at = '2026-01-02T00:00:00.000Z' WHERE id = 30",
    },
    {
      name: "the half-open end boundary",
      sql: "UPDATE approval_delegations SET ends_at = '2026-01-02T00:00:00.000Z' WHERE id = 30",
    },
    {
      name: "template scope changes",
      sql: "UPDATE approval_delegations SET template_code = 'other_template' WHERE id = 30",
    },
    {
      name: "delegate identity changes",
      sql: "UPDATE approval_delegations SET delegate_employee_id = 6 WHERE id = 30",
    },
    {
      name: "delegator identity changes",
      sql: "UPDATE approval_delegations SET delegator_employee_id = 3 WHERE id = 30",
    },
  ]

  for (const mutation of delegationMutations) {
    test(`revalidates delegation ${mutation.name} at the approval write boundary`, async () => {
      const setupResult = await setup({ version: 1, steps: [approvalStep] })
      await seedDelegation(setupResult.db, { id: 30 })
      setupResult.context.env.DB = beforeNextBatch(setupResult.context.env.DB, () =>
        setupResult.db.prepare(mutation.sql).run(),
      )

      const result = await decide(setupResult.context, setupResult.applicationId, 4)

      await expectNoApproval(result, setupResult.db, setupResult.applicationId)
    })
  }

  test("does not accept a delegated vote for a retired represented candidate", async () => {
    const setupResult = await setup({ version: 1, steps: [approvalStep] })
    await seedDelegation(setupResult.db, { id: 40 })
    await setupResult.db.prepare("UPDATE employees SET status = 'retired' WHERE id = 2").run()

    const result = await decide(setupResult.context, setupResult.applicationId, 4)

    await expectNoApproval(result, setupResult.db, setupResult.applicationId)
  })

  test("does not accept a delegated vote when the frozen candidate account is inactive", async () => {
    const setupResult = await setup({ version: 1, steps: [approvalStep] })
    await seedDelegation(setupResult.db, { id: 41 })
    await setupResult.db
      .prepare(
        `UPDATE accounts
         SET status = 'suspended', token_version = token_version + 1, updated_at = updated_at + 1
         WHERE id = 2`,
      )
      .run()

    const result = await decide(setupResult.context, setupResult.applicationId, 4)

    await expectNoApproval(result, setupResult.db, setupResult.applicationId)
  })

  test("does not accept a delegated vote from an inactive canonical actor account", async () => {
    const setupResult = await setup({ version: 1, steps: [approvalStep] })
    await seedDelegation(setupResult.db, { id: 411 })
    await setupResult.db
      .prepare(
        `UPDATE system_accounts
         SET status = 'locked', token_version = token_version + 1, updated_at = updated_at + 1
         WHERE id = '4'`,
      )
      .run()

    const result = await decide(setupResult.context, setupResult.applicationId, 4)

    await expectNoApproval(result, setupResult.db, setupResult.applicationId)
  })

  test("revalidates the canonical actor account at the approval write boundary", async () => {
    const setupResult = await setup({ version: 1, steps: [approvalStep] })
    await seedDelegation(setupResult.db, { id: 412 })
    setupResult.context.env.DB = beforeNextBatch(setupResult.context.env.DB, () =>
      setupResult.db
        .prepare(
          `UPDATE system_accounts
           SET status = 'locked', token_version = token_version + 1, updated_at = updated_at + 1
           WHERE id = '4'`,
        )
        .run(),
    )

    const result = await decide(setupResult.context, setupResult.applicationId, 4)

    await expectNoApproval(result, setupResult.db, setupResult.applicationId)
  })

  test("revalidates candidate account activity at the approval write boundary", async () => {
    const setupResult = await setup({ version: 1, steps: [approvalStep] })
    await seedDelegation(setupResult.db, { id: 42 })
    setupResult.context.env.DB = beforeNextBatch(setupResult.context.env.DB, () =>
      setupResult.db
        .prepare(
          `UPDATE accounts
           SET status = 'locked', token_version = token_version + 1, updated_at = updated_at + 1
           WHERE id = 2`,
        )
        .run(),
    )

    const result = await decide(setupResult.context, setupResult.applicationId, 4)

    await expectNoApproval(result, setupResult.db, setupResult.applicationId)
  })

  test("revalidates a direct actor against the frozen candidate account", async () => {
    const setupResult = await setup({ version: 1, steps: [approvalStep] })
    setupResult.context.env.DB = beforeNextBatch(setupResult.context.env.DB, () =>
      setupResult.db
        .prepare(
          `UPDATE application_workflow_step_candidates
           SET candidate_account_id = 3
           WHERE application_id = ?1 AND candidate_employee_id = 2`,
        )
        .bind(setupResult.applicationId)
        .run(),
    )

    const result = await decide(setupResult.context, setupResult.applicationId, 2)

    await expectNoApproval(result, setupResult.db, setupResult.applicationId)
  })

  test("does not transition on existing quorum when the new approval insert is rejected", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...approvalStep,
          approval_mode: "minimum",
          minimum_approvals: 2,
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
            { type: "employee", employee_code: "E004" },
          ],
        },
        {
          ...approvalStep,
          key: "final",
          name: "Final",
          approvers: [{ type: "employee", employee_code: "E006" }],
        },
      ],
    })
    await seedD1(setupResult.db, "application_workflow_approvals", [
      {
        application_id: setupResult.applicationId,
        step_key: "approval",
        round: 1,
        approver_id: 2,
        approver_account_id: 2,
        represented_approver_id: 2,
        delegation_id: null,
        action: "approve",
        comment: null,
        created_at: "2026-01-01T12:00:00.000Z",
      },
      {
        application_id: setupResult.applicationId,
        step_key: "approval",
        round: 1,
        approver_id: 3,
        approver_account_id: 3,
        represented_approver_id: 3,
        delegation_id: null,
        action: "approve",
        comment: null,
        created_at: "2026-01-01T13:00:00.000Z",
      },
    ])
    setupResult.context.env.DB = beforeNextBatch(setupResult.context.env.DB, () =>
      setupResult.db
        .prepare(
          `UPDATE accounts
           SET status = 'locked', token_version = token_version + 1, updated_at = updated_at + 1
           WHERE id = 4`,
        )
        .run(),
    )

    const result = await decide(setupResult.context, setupResult.applicationId, 4)
    const state = await setupResult.db
      .prepare(
        `SELECT application.current_step, workflow_instance.current_step_key
         FROM application_requests application
         INNER JOIN application_workflow_instances workflow_instance
           ON workflow_instance.application_id = application.id
         WHERE application.id = ?1`,
      )
      .bind(setupResult.applicationId)
      .first<{ current_step: string; current_step_key: string }>()
    const finalSnapshotCount = await setupResult.db
      .prepare(
        `SELECT COUNT(*) AS total FROM application_workflow_step_snapshots
         WHERE application_id = ?1 AND step_key = 'final'`,
      )
      .bind(setupResult.applicationId)
      .first<number>("total")
    const approvalCount = await setupResult.db
      .prepare(
        "SELECT COUNT(*) AS total FROM application_workflow_approvals WHERE application_id = ?1",
      )
      .bind(setupResult.applicationId)
      .first<number>("total")

    expect(result).toMatchObject({ code: "already_decided" })
    expect(state).toEqual({ current_step: "approval", current_step_key: "approval" })
    expect([finalSnapshotCount, approvalCount]).toEqual([0, 2])
  })

  test("keeps a direct vote valid without a delegation row", async () => {
    const setupResult = await setup({ version: 1, steps: [approvalStep] })

    expect(await decide(setupResult.context, setupResult.applicationId, 2)).toEqual({
      status: "approved",
    })
  })

  test("accepts a global delegation at its inclusive start boundary", async () => {
    const setupResult = await setup({ version: 1, steps: [approvalStep] })
    await seedDelegation(setupResult.db, { id: 50 })
    await setupResult.db
      .prepare(
        `UPDATE approval_delegations
         SET template_code = NULL, starts_at = '2026-01-02T00:00:00.000Z'
         WHERE id = 50`,
      )
      .run()

    expect(await decide(setupResult.context, setupResult.applicationId, 4)).toEqual({
      status: "approved",
    })
  })

  test("keeps one actor to one vote when they can represent multiple candidates", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...approvalStep,
          approval_mode: "minimum",
          minimum_approvals: 2,
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
          ],
        },
      ],
    })
    await seedDelegation(setupResult.db, { id: 51, delegatorEmployeeId: 2 })
    await seedDelegation(setupResult.db, { id: 52, delegatorEmployeeId: 3 })

    expect(await decide(setupResult.context, setupResult.applicationId, 4)).toEqual({
      status: "pending",
    })
    expect(await decide(setupResult.context, setupResult.applicationId, 4)).toMatchObject({
      code: "already_decided",
    })

    const approvalCount = await setupResult.db
      .prepare(
        "SELECT COUNT(*) AS total FROM application_workflow_approvals WHERE application_id = ?1",
      )
      .bind(setupResult.applicationId)
      .first<number>("total")
    expect(approvalCount).toBe(1)
  })
})
