import { DecideApplication } from "@/application/application/decide-application"
import { ResubmitApplication } from "@/application/application/resubmit-application"
import { Application } from "@/domain/application/application.entity"
import { ApplicationTemplate } from "@/domain/application/application-template.entity"
import type { ApplicationWorkflow } from "@/domain/application/application-workflow"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { ApplicationWorkflowRepository } from "@/infrastructure/application/application-workflow-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { describe, expect, test } from "bun:test"

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
  ])
  await seedD1(db, "org_memberships", [
    { department_code: "TEAM", employee_code: "E005", manager_employee_code: "E002" },
    { department_code: "HQ", employee_code: "E002", manager_employee_code: "E003" },
  ])
  await seedD1(db, "accounts", [
    { id: 2, employee_id: 2, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    { id: 3, employee_id: 3, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    { id: 4, employee_id: 4, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
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

  const application = await new ApplicationRepository(context).create(
    Application.create({
      templateId: template.id,
      applicantId: 5,
      currentStep: workflow.steps[0]?.key ?? null,
      payload: { amount: 100 },
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
  )
  if (application instanceof Error || application.id === null) throw application

  const initialized = await new ApplicationWorkflowRepository(context).createInstance({
    applicationId: application.id,
    definition: workflow,
    currentStepKey: workflow.steps[0]?.key ?? "",
    startedAt: "2026-01-01T00:00:00.000Z",
    dueAt: null,
  })
  if (initialized instanceof Error) throw initialized

  return { context, db, applicationId: application.id }
}

function approve(
  context: Awaited<ReturnType<typeof setup>>["context"],
  applicationId: number,
  employeeId: number,
) {
  return new DecideApplication(context).run({
    session: makeTestSession("member", employeeId),
    applicationId,
    approverId: employeeId,
    action: "approve",
    comment: null,
    createdAt: "2026-01-02T00:00:00.000Z",
  })
}

describe("configured application workflow", () => {
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
    expect(approvals[0]?.representedApproverId).toBe(2)
  })
})
