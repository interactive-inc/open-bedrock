import { DecideApplication } from "@/contexts/request/application/decide-application"
import { ResubmitApplication } from "@/contexts/request/application/resubmit-application"
import { ReassignWorkflowStep } from "@/contexts/request/application/reassign-workflow-step"
import { SubmitApplication } from "@/contexts/request/application/submit-application"
import { ApplicationTemplate } from "@/contexts/request/domain/application-template.entity"
import type { ApplicationWorkflow } from "@/contexts/request/domain/application-workflow"
import { ApplicationTemplateRepository } from "@/contexts/request/infrastructure/application-template-repository"
import { ApplicationWorkflowRepository } from "@/contexts/request/infrastructure/application-workflow-repository"
import { WorkflowSql } from "@/contexts/request/infrastructure/workflow-sql"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import { makeTestSession } from "@/contexts/company/interface/test-helpers/make-test-session"
import { ensureWorkflowStepEscalation } from "@/contexts/request/application/workflow/ensure-workflow-step-escalation"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { describe, expect, test } from "bun:test"
import { zAccountId } from "@system/domain/auth/account-id"

const firstStep = {
  key: "manager",
  name: "Manager approval",
  approvers: [{ type: "direct_manager" as const }],
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
    { id: 2, code: "E002", name: "Manager", status: "active" },
    { id: 3, code: "E003", name: "Director", status: "active" },
    { id: 4, code: "E004", name: "Delegate", status: "active" },
    { id: 5, code: "E005", name: "Applicant", status: "active" },
    { id: 99, code: "E099", name: "Workflow administrator", status: "active" },
  ])
  await seedD1(db, "org_memberships", [
    { department_code: "TEAM", employee_code: "E005", manager_employee_code: "E002" },
    { department_code: "HQ", employee_code: "E002", manager_employee_code: "E003" },
  ])
  await seedD1(db, "accounts", [
    { id: 1, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    { id: 2, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    { id: 3, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    { id: 4, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    { id: 5, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    { id: 99, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
  ])
  await seedD1(db, "account_employee_links", [
    { account_id: 2, employee_id: 2 },
    { account_id: 3, employee_id: 3 },
    { account_id: 4, employee_id: 4 },
    { account_id: 5, employee_id: 5 },
    { account_id: 99, employee_id: 99 },
  ])

  const template = await new ApplicationTemplateRepository(context).create(
    ApplicationTemplate.create({
      code: "workflow_test",
      name: "Workflow test",
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
    templateCode: "workflow_test",
    payload: { amount: 100 },
    createdAt: "2026-01-01T00:00:00.000Z",
  })
  if (application instanceof Error || application.id === null) throw application

  return { context, db, applicationId: application.id }
}

function approve(
  context: Awaited<ReturnType<typeof setup>>["context"],
  applicationId: number,
  employeeId: number,
  createdAt = "2026-01-02T00:00:00.000Z",
) {
  return new DecideApplication(context).run({
    session: makeTestSession("member", employeeId),
    applicationId,
    approverId: employeeId,
    action: "approve",
    comment: null,
    createdAt,
  })
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

describe("configured application workflow", () => {
  test("chunks large candidate snapshots below the D1 statement limit", () => {
    const { db } = createTestContext()
    const snapshot = {
      requiredApprovals: 1,
      activatedAt: "2026-01-01T00:00:00.000Z",
      dueAt: null,
      escalatedAt: null,
      resolutionReason: "activation" as const,
      resolutionId: "large-resolution",
      candidates: Array.from({ length: 100 }, (_, index) => ({
        employeeId: index + 1,
        accountId: zAccountId.parse(String(index + 1)),
        source: "primary" as const,
        selectorsJson: "[]",
        eligibleFrom: null,
        resolvedAt: "2026-01-01T00:00:00.000Z",
      })),
    }

    expect(
      new WorkflowSql(db).insert({
        applicationId: 1,
        stepKey: "large",
        round: 1,
        snapshot,
      }).length,
    ).toBeLessThanOrEqual(8)
    expect(
      new WorkflowSql(db).conditionalInsert({
        applicationId: 1,
        stepKey: "large",
        round: 1,
        snapshot,
        currentStepKey: "current",
        currentRound: 1,
        requiredApprovals: 1,
      }).length,
    ).toBeLessThanOrEqual(10)
  })

  test("advances sequential organization-based steps", async () => {
    const workflow: ApplicationWorkflow = {
      version: 1,
      steps: [
        firstStep,
        {
          ...firstStep,
          key: "director",
          name: "Director approval",
          approvers: [{ type: "employee", employee_code: "E003" }],
        },
      ],
    }
    const setupResult = await setup(workflow)

    expect(await approve(setupResult.context, setupResult.applicationId, 2)).toEqual({
      status: "pending",
    })
    expect(await approve(setupResult.context, setupResult.applicationId, 3)).toEqual({
      status: "approved",
    })
  })

  test("requires all parallel approvers", async () => {
    const workflow: ApplicationWorkflow = {
      version: 1,
      steps: [
        {
          ...firstStep,
          approval_mode: "all",
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
          ],
        },
      ],
    }
    const setupResult = await setup(workflow)

    expect(await approve(setupResult.context, setupResult.applicationId, 2)).toEqual({
      status: "pending",
    })
    expect(await approve(setupResult.context, setupResult.applicationId, 3)).toEqual({
      status: "approved",
    })
  })

  test("preserves return history and starts a new round on resubmit", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [{ ...firstStep, rejection_behavior: "return" }],
    })
    const returned = await new DecideApplication(setupResult.context).run({
      session: makeTestSession("member", 2),
      applicationId: setupResult.applicationId,
      approverId: 2,
      action: "reject",
      comment: "Please revise",
      createdAt: "2026-01-02T00:00:00.000Z",
    })
    expect(returned).toEqual({ status: "pending" })

    const resubmitted = await new ResubmitApplication(setupResult.context).run({
      applicationId: setupResult.applicationId,
      applicantId: 5,
      payload: { amount: 80 },
      resubmittedAt: "2026-01-03T00:00:00.000Z",
    })
    expect(resubmitted).toMatchObject({ status: "pending", currentStep: "manager" })
    expect(await approve(setupResult.context, setupResult.applicationId, 2)).toEqual({
      status: "approved",
    })

    const approvals = await new ApplicationWorkflowRepository(setupResult.context).listApprovals(
      setupResult.applicationId,
    )
    if (approvals instanceof Error) throw approvals
    expect(approvals.map((row) => [row.round, row.action])).toEqual([
      [1, "return"],
      [2, "approve"],
    ])
  })

  test("uses a fresh round when a later step is reached again after return and resubmit", async () => {
    const secondStep = {
      ...firstStep,
      key: "finance",
      name: "Finance approval",
      approvers: [
        { type: "employee" as const, employee_code: "E003" },
        { type: "employee" as const, employee_code: "E004" },
      ],
      approval_mode: "minimum" as const,
      minimum_approvals: 2,
      rejection_behavior: "return" as const,
    }
    const setupResult = await setup({ version: 1, steps: [firstStep, secondStep] })

    expect(
      await approve(setupResult.context, setupResult.applicationId, 2, "2026-01-02T00:00:00.000Z"),
    ).toEqual({ status: "pending" })
    expect(
      await approve(setupResult.context, setupResult.applicationId, 3, "2026-01-02T01:00:00.000Z"),
    ).toEqual({ status: "pending" })
    expect(
      await new DecideApplication(setupResult.context).run({
        session: makeTestSession("member", 4),
        applicationId: setupResult.applicationId,
        approverId: 4,
        action: "reject",
        comment: "Please revise",
        createdAt: "2026-01-02T02:00:00.000Z",
      }),
    ).toEqual({ status: "pending" })

    expect(
      await new ResubmitApplication(setupResult.context).run({
        applicationId: setupResult.applicationId,
        applicantId: 5,
        payload: { amount: 100 },
        resubmittedAt: "2026-01-03T00:00:00.000Z",
      }),
    ).toMatchObject({ status: "pending", currentStep: "manager" })
    expect(
      await approve(setupResult.context, setupResult.applicationId, 2, "2026-01-04T00:00:00.000Z"),
    ).toEqual({ status: "pending" })

    const instance = await new ApplicationWorkflowRepository(setupResult.context).findInstance(
      setupResult.applicationId,
    )
    if (instance === null || instance instanceof Error) throw instance
    expect(instance).toMatchObject({ currentStepKey: "finance", currentRound: 2 })

    const financeSnapshots = await setupResult.db
      .prepare(
        `SELECT round, resolution_id FROM application_workflow_step_snapshots
         WHERE application_id = ?1 AND step_key = 'finance' ORDER BY round`,
      )
      .bind(setupResult.applicationId)
      .all<{ round: number; resolution_id: string }>()
    expect(financeSnapshots.results.map((snapshot) => snapshot.round)).toEqual([1, 2])
    expect(new Set(financeSnapshots.results.map((snapshot) => snapshot.resolution_id)).size).toBe(2)

    expect(
      await approve(setupResult.context, setupResult.applicationId, 4, "2026-01-04T01:00:00.000Z"),
    ).toEqual({ status: "pending" })
    expect(
      await approve(setupResult.context, setupResult.applicationId, 3, "2026-01-04T02:00:00.000Z"),
    ).toEqual({ status: "approved" })

    const financeApprovals = await new ApplicationWorkflowRepository(
      setupResult.context,
    ).listApprovals(setupResult.applicationId, "finance")
    if (financeApprovals instanceof Error) throw financeApprovals
    expect(financeApprovals.map((approval) => [approval.round, approval.action])).toEqual([
      [1, "approve"],
      [1, "return"],
      [2, "approve"],
      [2, "approve"],
    ])
  })

  test("allows an active period-scoped delegate", async () => {
    const setupResult = await setup({ version: 1, steps: [firstStep] })
    await seedD1(setupResult.db, "approval_delegations", [
      {
        delegator_employee_id: 2,
        delegate_employee_id: 4,
        template_code: "workflow_test",
        starts_at: "2026-01-01T00:00:00.000Z",
        ends_at: "2026-01-31T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ])

    expect(await approve(setupResult.context, setupResult.applicationId, 4)).toEqual({
      status: "approved",
    })
    const approvals = await new ApplicationWorkflowRepository(setupResult.context).listApprovals(
      setupResult.applicationId,
    )
    if (approvals instanceof Error) throw approvals
    expect(approvals[0]).toMatchObject({
      approverId: 4,
      approverAccountId: "4",
      representedApproverId: 2,
      delegationId: 1,
    })
  })

  test("retains the deciding account for a direct approval", async () => {
    const setupResult = await setup({ version: 1, steps: [firstStep] })

    expect(await approve(setupResult.context, setupResult.applicationId, 2)).toEqual({
      status: "approved",
    })

    const approvals = await new ApplicationWorkflowRepository(setupResult.context).listApprovals(
      setupResult.applicationId,
    )
    if (approvals instanceof Error) throw approvals
    expect(approvals[0]).toMatchObject({
      approverId: 2,
      approverAccountId: "2",
      representedApproverId: 2,
      delegationId: null,
    })
  })

  test("uses an unrepresented delegator when one delegate covers multiple candidates", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...firstStep,
          approval_mode: "minimum",
          minimum_approvals: 2,
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
          ],
        },
      ],
    })
    await seedD1(setupResult.db, "approval_delegations", [
      {
        id: 10,
        delegator_employee_id: 2,
        delegate_employee_id: 4,
        template_code: "workflow_test",
        starts_at: "2026-01-01T00:00:00.000Z",
        ends_at: "2026-01-31T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 11,
        delegator_employee_id: 3,
        delegate_employee_id: 4,
        template_code: "workflow_test",
        starts_at: "2026-01-01T00:00:00.000Z",
        ends_at: "2026-01-31T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ])

    expect(await approve(setupResult.context, setupResult.applicationId, 2)).toEqual({
      status: "pending",
    })
    expect(await approve(setupResult.context, setupResult.applicationId, 4)).toEqual({
      status: "approved",
    })

    const approvals = await new ApplicationWorkflowRepository(setupResult.context).listApprovals(
      setupResult.applicationId,
    )
    if (approvals instanceof Error) throw approvals
    expect(approvals.at(-1)).toMatchObject({
      approverId: 4,
      representedApproverId: 3,
      delegationId: 11,
    })
  })

  test("stores only the selector and evidence that resolved each candidate", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...firstStep,
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
          ],
        },
      ],
    })

    const candidates = await setupResult.db
      .prepare(
        `SELECT candidate_employee_id, selectors_json
           FROM application_workflow_step_candidates
           WHERE application_id = ?1
           ORDER BY candidate_employee_id`,
      )
      .bind(setupResult.applicationId)
      .all<{ candidate_employee_id: number; selectors_json: string }>()

    expect(
      candidates.results.map((candidate) => [
        candidate.candidate_employee_id,
        JSON.parse(candidate.selectors_json),
      ]),
    ).toEqual([
      [
        2,
        [
          {
            selector_index: 0,
            selector: { type: "employee", employee_code: "E002" },
            evidence: {
              type: "employee_code",
              employee_code: "E002",
              system_account_id: "2",
              authority_snapshot: {
                schema_version: 1,
                source: "legacy",
                as_of: "2026-01-01",
                organization_revision: null,
              },
            },
          },
        ],
      ],
      [
        3,
        [
          {
            selector_index: 1,
            selector: { type: "employee", employee_code: "E003" },
            evidence: {
              type: "employee_code",
              employee_code: "E003",
              system_account_id: "3",
              authority_snapshot: {
                schema_version: 1,
                source: "legacy",
                as_of: "2026-01-01",
                organization_revision: null,
              },
            },
          },
        ],
      ],
    ])
  })

  test("keeps the activated step approver after the reporting line changes", async () => {
    const setupResult = await setup({ version: 1, steps: [firstStep] })

    await setupResult.db
      .prepare(
        "UPDATE org_memberships SET manager_employee_code = 'E003' WHERE employee_code = 'E005'",
      )
      .run()

    expect(await approve(setupResult.context, setupResult.applicationId, 2)).toEqual({
      status: "approved",
    })
  })

  test("records escalation as an idempotent state transition before granting authority", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...firstStep,
          due_days: 1,
          escalation_approvers: [{ type: "employee", employee_code: "E003" }],
        },
      ],
    })

    const beforeDeadline = await approve(
      setupResult.context,
      setupResult.applicationId,
      3,
      "2026-01-01T23:59:59.999Z",
    )
    expect(beforeDeadline).toMatchObject({ code: "forbidden" })

    expect(
      await approve(setupResult.context, setupResult.applicationId, 3, "2026-01-02T00:00:00.000Z"),
    ).toEqual({ status: "approved" })

    const snapshot = await setupResult.db
      .prepare(
        "SELECT escalated_at FROM application_workflow_step_snapshots WHERE application_id = ?1",
      )
      .bind(setupResult.applicationId)
      .first<string>("escalated_at")
    const eventCount = await setupResult.db
      .prepare(
        `SELECT COUNT(*) AS total FROM application_workflow_events
         WHERE application_id = ?1 AND event_type = 'escalated'`,
      )
      .bind(setupResult.applicationId)
      .first<number>("total")

    expect(snapshot).toBe("2026-01-02T00:00:00.000Z")
    expect(eventCount).toBe(1)
  })

  test("does not escalate a snapshot after its application is no longer on that round", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...firstStep,
          due_days: 1,
          escalation_approvers: [{ type: "employee", employee_code: "E003" }],
        },
      ],
    })
    const snapshot = await new ApplicationWorkflowRepository(setupResult.context).findStepSnapshot(
      setupResult.applicationId,
      "manager",
      1,
    )
    if (snapshot === null || snapshot instanceof Error) throw snapshot
    await setupResult.db
      .prepare(
        "UPDATE application_requests SET status = 'approved', current_step = NULL WHERE id = ?1",
      )
      .bind(setupResult.applicationId)
      .run()

    const result = await ensureWorkflowStepEscalation({
      c: setupResult.context,
      snapshot,
      now: "2026-01-02T00:00:00.000Z",
    })

    expect(result).toMatchObject({ escalatedAt: null })
    expect(
      await setupResult.db
        .prepare(
          `SELECT COUNT(*) AS total FROM application_workflow_events
           WHERE application_id = ?1 AND event_type = 'escalated'`,
        )
        .bind(setupResult.applicationId)
        .first<number>("total"),
    ).toBe(0)
  })

  test("completes a minimum quorum when the final approvals arrive concurrently", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...firstStep,
          approval_mode: "minimum",
          minimum_approvals: 2,
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
          ],
        },
      ],
    })

    setupResult.context.env.DB = pauseMatchingAllQueriesUntilBothArrive(
      setupResult.context.env.DB,
      "SELECT DISTINCT approval.represented_approver_id",
    )

    const results = await Promise.all([
      approve(setupResult.context, setupResult.applicationId, 2),
      approve(setupResult.context, setupResult.applicationId, 3),
    ])

    expect(
      results.some((result) => !(result instanceof Error) && result.status === "approved"),
    ).toBe(true)

    const status = await setupResult.db
      .prepare("SELECT status FROM application_requests WHERE id = ?1")
      .bind(setupResult.applicationId)
      .first<string>("status")

    expect(status).toBe("approved")
  })

  test("backfills a candidate snapshot for an active workflow created before the migration", async () => {
    const setupResult = await setup({ version: 1, steps: [firstStep] })

    await setupResult.db
      .prepare("DELETE FROM application_workflow_step_candidates WHERE application_id = ?1")
      .bind(setupResult.applicationId)
      .run()
    await setupResult.db
      .prepare("DELETE FROM application_workflow_step_snapshots WHERE application_id = ?1")
      .bind(setupResult.applicationId)
      .run()

    expect(await approve(setupResult.context, setupResult.applicationId, 2)).toEqual({
      status: "approved",
    })

    const reason = await setupResult.db
      .prepare(
        "SELECT resolution_reason FROM application_workflow_step_snapshots WHERE application_id = ?1",
      )
      .bind(setupResult.applicationId)
      .first<string>("resolution_reason")

    expect(reason).toBe("legacy_backfill")
  })

  test("does not attach a workflow instance to an application that is no longer pending", async () => {
    const setupResult = await setup({ version: 1, steps: [firstStep] })
    await setupResult.db
      .prepare("DELETE FROM application_workflow_step_candidates WHERE application_id = ?1")
      .bind(setupResult.applicationId)
      .run()
    await setupResult.db
      .prepare("DELETE FROM application_workflow_step_snapshots WHERE application_id = ?1")
      .bind(setupResult.applicationId)
      .run()
    await setupResult.db
      .prepare("DELETE FROM application_workflow_instances WHERE application_id = ?1")
      .bind(setupResult.applicationId)
      .run()
    await setupResult.db
      .prepare(
        "UPDATE application_requests SET status = 'approved', current_step = NULL WHERE id = ?1",
      )
      .bind(setupResult.applicationId)
      .run()

    const result = await new ApplicationWorkflowRepository(setupResult.context).createInstance({
      applicationId: setupResult.applicationId,
      definition: { version: 1, steps: [firstStep] },
      currentStepKey: firstStep.key,
      startedAt: "2026-01-02T00:00:00.000Z",
      dueAt: null,
      stepSnapshot: {
        requiredApprovals: 1,
        activatedAt: "2026-01-02T00:00:00.000Z",
        dueAt: null,
        escalatedAt: null,
        resolutionReason: "legacy_backfill",
        resolutionId: "late-instance",
        candidates: [
          {
            employeeId: 2,
            accountId: zAccountId.parse("2"),
            source: "primary",
            selectorsJson: "[]",
            eligibleFrom: null,
            resolvedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      },
    })

    expect(result).toBeInstanceOf(Error)
    const instanceCount = await setupResult.db
      .prepare(
        "SELECT COUNT(*) AS total FROM application_workflow_instances WHERE application_id = ?1",
      )
      .bind(setupResult.applicationId)
      .first<number>("total")
    const snapshotCount = await setupResult.db
      .prepare(
        "SELECT COUNT(*) AS total FROM application_workflow_step_snapshots WHERE application_id = ?1",
      )
      .bind(setupResult.applicationId)
      .first<number>("total")
    expect([instanceCount, snapshotCount]).toEqual([0, 0])
  })

  test("repairs an unresolvable active step by starting an audited round", async () => {
    const setupResult = await setup({ version: 1, steps: [firstStep] })
    await setupResult.db
      .prepare("DELETE FROM application_workflow_step_candidates WHERE application_id = ?1")
      .bind(setupResult.applicationId)
      .run()
    await setupResult.db
      .prepare("DELETE FROM application_workflow_step_snapshots WHERE application_id = ?1")
      .bind(setupResult.applicationId)
      .run()
    await setupResult.db
      .prepare(
        "UPDATE org_memberships SET manager_employee_code = NULL WHERE employee_code = 'E005'",
      )
      .run()

    const repaired = await new ReassignWorkflowStep(setupResult.context).run({
      session: makeTestSession("hr", 99),
      applicationId: setupResult.applicationId,
      candidateEmployeeIds: [3],
      reason: "Current manager account is unavailable",
      reassignedAt: "2026-01-02T00:00:00.000Z",
    })

    expect(repaired).toEqual({
      status: "pending",
      stepKey: "manager",
      round: 2,
      candidateEmployeeIds: [3],
    })
    expect(await approve(setupResult.context, setupResult.applicationId, 3)).toEqual({
      status: "approved",
    })
    const event = await setupResult.db
      .prepare(
        `SELECT actor_account_id, details_json FROM application_workflow_events
         WHERE application_id = ?1 AND event_type = 'reassigned'`,
      )
      .bind(setupResult.applicationId)
      .first<{ actor_account_id: string; details_json: string }>()
    expect(event?.actor_account_id).toBe("99")
    expect(JSON.parse(event?.details_json ?? "{}")).toMatchObject({
      candidate_employee_ids: [3],
      previous_round: 1,
    })
  })

  test("does not repair a workflow step that can still reach quorum", async () => {
    const setupResult = await setup({ version: 1, steps: [firstStep] })

    const repaired = await new ReassignWorkflowStep(setupResult.context).run({
      session: makeTestSession("hr", 99),
      applicationId: setupResult.applicationId,
      candidateEmployeeIds: [3],
      reason: "Unnecessary override",
      reassignedAt: "2026-01-02T00:00:00.000Z",
    })

    expect(repaired).toMatchObject({ code: "workflow_not_repairable" })
    expect(
      await setupResult.db
        .prepare(
          "SELECT current_round FROM application_workflow_instances WHERE application_id = ?1",
        )
        .bind(setupResult.applicationId)
        .first<number>("current_round"),
    ).toBe(1)
  })

  test("keeps the original quorum and forbids self-assignment during repair", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...firstStep,
          approval_mode: "minimum",
          minimum_approvals: 2,
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
          ],
        },
      ],
    })
    await setupResult.db.prepare("UPDATE employees SET status = 'retired' WHERE id = 2").run()

    const tooFew = await new ReassignWorkflowStep(setupResult.context).run({
      session: makeTestSession("hr", 99),
      applicationId: setupResult.applicationId,
      candidateEmployeeIds: [4],
      reason: "Incomplete replacement set",
      reassignedAt: "2026-01-02T00:00:00.000Z",
    })
    expect(tooFew).toMatchObject({ code: "workflow_unresolvable" })

    const selfAssigned = await new ReassignWorkflowStep(setupResult.context).run({
      session: makeTestSession("hr", 3),
      applicationId: setupResult.applicationId,
      candidateEmployeeIds: [3, 4],
      reason: "Self assignment",
      reassignedAt: "2026-01-02T00:00:00.000Z",
    })
    expect(selfAssigned).toMatchObject({ code: "invalid_candidate" })

    const repaired = await new ReassignWorkflowStep(setupResult.context).run({
      session: makeTestSession("hr", 99),
      applicationId: setupResult.applicationId,
      candidateEmployeeIds: [3, 4],
      reason: "Complete replacement set",
      reassignedAt: "2026-01-02T00:00:00.000Z",
    })
    expect(repaired).toMatchObject({ candidateEmployeeIds: [3, 4], round: 2 })
    expect(
      await setupResult.db
        .prepare(
          `SELECT required_approvals FROM application_workflow_step_snapshots
           WHERE application_id = ?1 AND round = 2`,
        )
        .bind(setupResult.applicationId)
        .first<number>("required_approvals"),
    ).toBe(2)
  })

  test("does not persist the deciding approval when the next step cannot be activated", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...firstStep,
          approvers: [{ type: "employee", employee_code: "E002" }],
        },
        {
          ...firstStep,
          key: "second",
          name: "Second approval",
        },
      ],
    })

    await setupResult.db
      .prepare(
        "UPDATE org_memberships SET manager_employee_code = NULL WHERE employee_code = 'E005'",
      )
      .run()

    const result = await approve(setupResult.context, setupResult.applicationId, 2)

    expect(result).toBeInstanceOf(Error)

    const approvalCount = await setupResult.db
      .prepare(
        "SELECT COUNT(*) AS total FROM application_workflow_approvals WHERE application_id = ?1",
      )
      .bind(setupResult.applicationId)
      .first<number>("total")

    expect(approvalCount).toBe(0)
  })

  test("records non-final quorum votes before resolving the next step", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...firstStep,
          approval_mode: "minimum",
          minimum_approvals: 2,
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
          ],
        },
        {
          ...firstStep,
          key: "missing",
          approvers: [{ type: "employee", employee_code: "MISSING" }],
        },
      ],
    })

    expect(await approve(setupResult.context, setupResult.applicationId, 2)).toEqual({
      status: "pending",
    })

    const finalVote = await approve(setupResult.context, setupResult.applicationId, 3)
    expect(finalVote).toMatchObject({ code: "workflow_unresolvable" })

    const approvals = await new ApplicationWorkflowRepository(setupResult.context).listApprovals(
      setupResult.applicationId,
    )
    if (approvals instanceof Error) throw approvals
    expect(approvals.map((approval) => approval.approverId)).toEqual([2])
  })

  test("does not activate a step whose only approver is retired", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        firstStep,
        {
          ...firstStep,
          key: "retired",
          approvers: [{ type: "employee", employee_code: "E003" }],
        },
      ],
    })
    await setupResult.db.prepare("UPDATE employees SET status = 'retired' WHERE id = 3").run()

    const result = await approve(setupResult.context, setupResult.applicationId, 2)

    expect(result).toMatchObject({ code: "workflow_unresolvable" })
    const approvalCount = await setupResult.db
      .prepare(
        "SELECT COUNT(*) AS total FROM application_workflow_approvals WHERE application_id = ?1",
      )
      .bind(setupResult.applicationId)
      .first<number>("total")
    expect(approvalCount).toBe(0)
  })

  test("does not merge candidates from a losing concurrent snapshot resolution", async () => {
    const setupResult = await setup({ version: 1, steps: [firstStep] })

    await setupResult.db
      .prepare("DELETE FROM application_workflow_step_candidates WHERE application_id = ?1")
      .bind(setupResult.applicationId)
      .run()
    await setupResult.db
      .prepare("DELETE FROM application_workflow_step_snapshots WHERE application_id = ?1")
      .bind(setupResult.applicationId)
      .run()

    const snapshot = (employeeId: number) => ({
      requiredApprovals: 1,
      activatedAt: "2026-01-01T00:00:00.000Z",
      dueAt: null,
      escalatedAt: null,
      resolutionReason: "legacy_backfill" as const,
      resolutionId: `resolution-${employeeId}`,
      candidates: [
        {
          employeeId,
          accountId: zAccountId.parse(String(employeeId)),
          source: "primary" as const,
          selectorsJson: "[]",
          eligibleFrom: null,
          resolvedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    })

    for (const candidateEmployeeId of [2, 3]) {
      await setupResult.db.batch([
        ...new WorkflowSql(setupResult.db).insert({
          applicationId: setupResult.applicationId,
          stepKey: "manager",
          round: 1,
          snapshot: snapshot(candidateEmployeeId),
          ignoreConflicts: true,
        }),
      ])
    }

    const candidates = await setupResult.db
      .prepare(
        "SELECT candidate_employee_id FROM application_workflow_step_candidates WHERE application_id = ?1 ORDER BY candidate_employee_id",
      )
      .bind(setupResult.applicationId)
      .all<{ candidate_employee_id: number }>()

    expect(candidates.results.map((candidate) => candidate.candidate_employee_id)).toEqual([2])
  })

  test("does not count a legacy approval outside the backfilled candidate snapshot", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...firstStep,
          approval_mode: "minimum",
          minimum_approvals: 2,
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
          ],
        },
      ],
    })

    await setupResult.db
      .prepare("DELETE FROM application_workflow_step_candidates WHERE application_id = ?1")
      .bind(setupResult.applicationId)
      .run()
    await setupResult.db
      .prepare("DELETE FROM application_workflow_step_snapshots WHERE application_id = ?1")
      .bind(setupResult.applicationId)
      .run()
    await seedD1(setupResult.db, "application_workflow_approvals", [
      {
        application_id: setupResult.applicationId,
        step_key: "manager",
        round: 1,
        approver_id: 4,
        represented_approver_id: 4,
        action: "approve",
        comment: null,
        created_at: "2026-01-01T12:00:00.000Z",
      },
    ])

    expect(await approve(setupResult.context, setupResult.applicationId, 2)).toEqual({
      status: "pending",
    })

    const status = await setupResult.db
      .prepare("SELECT status FROM application_requests WHERE id = ?1")
      .bind(setupResult.applicationId)
      .first<string>("status")

    expect(status).toBe("pending")
  })

  test("notifies only the winning approver when final approvals race", async () => {
    const setupResult = await setup({
      version: 1,
      steps: [
        {
          ...firstStep,
          approvers: [
            { type: "employee", employee_code: "E002" },
            { type: "employee", employee_code: "E003" },
          ],
        },
      ],
    })

    const results = await Promise.all([
      approve(setupResult.context, setupResult.applicationId, 2),
      approve(setupResult.context, setupResult.applicationId, 3),
    ])

    expect(results.filter((result) => result instanceof Error)).toHaveLength(1)

    const approvalCount = await setupResult.db
      .prepare(
        "SELECT COUNT(*) AS total FROM application_workflow_approvals WHERE application_id = ?1",
      )
      .bind(setupResult.applicationId)
      .first<number>("total")
    const notificationCount = await setupResult.db
      .prepare(
        "SELECT COUNT(*) AS total FROM notifications WHERE source_domain = 'application' AND source_id = ?1",
      )
      .bind(setupResult.applicationId)
      .first<number>("total")

    expect(approvalCount).toBe(1)
    expect(notificationCount).toBe(1)
  })
})
