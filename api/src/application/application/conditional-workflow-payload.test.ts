import { DecideApplication } from "@/application/application/decide-application"
import { ResubmitApplication } from "@/application/application/resubmit-application"
import { SubmitApplication } from "@/application/application/submit-application"
import { ApplicationTemplate } from "@/domain/application/application-template.entity"
import type { ApplicationWorkflow } from "@/domain/application/application-workflow"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { ApplicationWorkflowRepository } from "@/infrastructure/application/application-workflow-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { describe, expect, test } from "bun:test"

const workflow: ApplicationWorkflow = {
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
      rejection_behavior: "return",
      allow_delegation: true,
    },
    {
      key: "high_value",
      name: "High-value approval",
      approvers: [{ type: "employee", employee_code: "E003" }],
      approval_mode: "any",
      condition_mode: "all",
      conditions: [{ source: "payload", field: "amount", operator: "gte", value: 1_000 }],
      due_days: null,
      escalation_approvers: [],
      rejection_behavior: "reject",
      allow_delegation: true,
    },
  ],
}

describe("conditional application workflow payload", () => {
  test("requires a newly applicable step after a returned low-value request is resubmitted high", async () => {
    const { context, db } = createTestContext()
    await seedD1(db, "employees", [
      { id: 2, code: "E002", name: "Manager", status: "active" },
      { id: 3, code: "E003", name: "Director", status: "active" },
      { id: 5, code: "E005", name: "Applicant", status: "active" },
    ])
    await seedD1(db, "org_memberships", [
      { department_code: "TEAM", employee_code: "E005", manager_employee_code: "E002" },
    ])
    await seedD1(db, "accounts", [
      { id: 2, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
      { id: 3, status: "active", token_version: 0, created_at: 0, updated_at: 0 },
    ])
    await seedD1(db, "account_employee_links", [
      { account_id: 2, employee_id: 2 },
      { account_id: 3, employee_id: 3 },
    ])

    const template = await new ApplicationTemplateRepository(context).create(
      ApplicationTemplate.create({
        code: "conditional_expense",
        name: "Conditional expense",
        category: "accounting",
        description: null,
        schemaJson: {
          fields: [
            {
              id: "amount",
              label: "Amount",
              type: "number",
              required: true,
              description: null,
              options: null,
            },
          ],
        },
        approverRoles: [],
      }),
    )
    if (template instanceof Error || template.id === null) throw template

    const saved = await new ApplicationWorkflowRepository(context).saveDefinition({
      templateId: template.id,
      definition: workflow,
      expectedRevision: 0,
      updatedByAccountId: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
    })
    if (saved instanceof Error) throw saved

    const application = await new SubmitApplication(context).run({
      applicantId: 5,
      templateCode: "conditional_expense",
      payload: { amount: 100 },
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    if (application instanceof Error || application.id === null) throw application

    const initialInstance = await new ApplicationWorkflowRepository(context).findInstance(
      application.id,
    )
    if (initialInstance === null || initialInstance instanceof Error) throw initialInstance
    expect(initialInstance.definition.steps.map((step) => step.key)).toEqual([
      "manager",
      "high_value",
    ])

    expect(
      await new DecideApplication(context).run({
        session: makeTestSession("member", 2),
        applicationId: application.id,
        approverId: 2,
        action: "reject",
        comment: "Please revise",
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
    ).toEqual({ status: "pending" })

    const invalidResubmission = await new ResubmitApplication(context).run({
      applicationId: application.id,
      applicantId: 5,
      payload: { amount: "2000" },
      resubmittedAt: "2026-01-03T00:00:00.000Z",
    })
    expect(invalidResubmission).toMatchObject({ code: "invalid_payload" })
    expect(
      await db
        .prepare("SELECT current_step FROM application_requests WHERE id = ?1")
        .bind(application.id)
        .first<string>("current_step"),
    ).toBe("returned:manager")

    const originalDb = context.env.DB
    let injectedConcurrentChange = false
    context.env.DB = new Proxy(originalDb, {
      get(target, property, receiver) {
        if (property === "batch") {
          return async (statements: Array<D1PreparedStatement>) => {
            if (injectedConcurrentChange === false) {
              injectedConcurrentChange = true
              await originalDb
                .prepare(
                  `UPDATE application_workflow_instances
                   SET current_round = current_round + 1
                   WHERE application_id = ?1`,
                )
                .bind(application.id)
                .run()
            }

            return target.batch(statements)
          }
        }

        return Reflect.get(target, property, receiver)
      },
    })

    const racedResubmission = await new ResubmitApplication(context).run({
      applicationId: application.id,
      applicantId: 5,
      payload: { amount: 2_000 },
      resubmittedAt: "2026-01-03T00:00:00.000Z",
    })
    expect(racedResubmission).toMatchObject({ code: "not_returned" })
    expect(
      await originalDb
        .prepare("SELECT current_step FROM application_requests WHERE id = ?1")
        .bind(application.id)
        .first<string>("current_step"),
    ).toBe("returned:manager")
    expect(
      await originalDb
        .prepare(
          `SELECT COUNT(*) AS total FROM application_workflow_step_snapshots
           WHERE application_id = ?1 AND step_key = 'manager' AND round = 2`,
        )
        .bind(application.id)
        .first<number>("total"),
    ).toBe(0)

    context.env.DB = originalDb
    await originalDb
      .prepare(
        `UPDATE application_workflow_instances SET current_round = 1
         WHERE application_id = ?1`,
      )
      .bind(application.id)
      .run()

    expect(
      await new ResubmitApplication(context).run({
        applicationId: application.id,
        applicantId: 5,
        payload: { amount: 2_000 },
        resubmittedAt: "2026-01-03T00:00:00.000Z",
      }),
    ).toMatchObject({ status: "pending", currentStep: "manager", payload: { amount: 2_000 } })

    expect(
      await new DecideApplication(context).run({
        session: makeTestSession("member", 2),
        applicationId: application.id,
        approverId: 2,
        action: "approve",
        comment: null,
        createdAt: "2026-01-04T00:00:00.000Z",
      }),
    ).toEqual({ status: "pending" })

    const highValueInstance = await new ApplicationWorkflowRepository(context).findInstance(
      application.id,
    )
    if (highValueInstance === null || highValueInstance instanceof Error) throw highValueInstance
    expect(highValueInstance.currentStepKey).toBe("high_value")

    expect(
      await new DecideApplication(context).run({
        session: makeTestSession("member", 3),
        applicationId: application.id,
        approverId: 3,
        action: "approve",
        comment: null,
        createdAt: "2026-01-05T00:00:00.000Z",
      }),
    ).toEqual({ status: "approved" })

    const approvals = await new ApplicationWorkflowRepository(context).listApprovals(application.id)
    if (approvals instanceof Error) throw approvals
    expect(
      approvals
        .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map(({ stepKey, round, action }) => [stepKey, round, action]),
    ).toEqual([
      ["manager", 1, "return"],
      ["manager", 2, "approve"],
      ["high_value", 1, "approve"],
    ])
  })
})
