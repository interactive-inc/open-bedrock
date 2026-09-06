import { withCurrentDecisionTarget } from "@tests/api/support/with-current-decision-target"
import { describe, expect, spyOn, test } from "bun:test"
import { z } from "zod"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"

async function createFixture() {
  const c = await createGovernanceTaskTestContext()
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: { version: 1, steps: [c.step] },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: "governance_test",
    revision: 1,
    title: "Governance review",
    category: "test",
    description: "Company authority workflow",
    inputSchema: {
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
    decisionPolicy: policy,
    completionOperationKey: null,
    createdByAccountId: c.creator.accountId,
    createdAt: c.at,
  })
  if (definition instanceof Error) throw definition
  const published = await new SystemD1ProcedureRepository({ env: { DB: c.database } }).publish(
    definition,
    0,
  )
  if (published !== true) throw published
  const request = async (index: number, path: string, body: unknown) => {
    const person = c.people[index]
    if (person === undefined) throw new Error("person is missing")
    return requestWithContext({
      db: c.database,
      jwtSecret: "governance-workflow-test",
      path,
      method: "POST",
      body: await withCurrentDecisionTarget(c.database, path, body),
      now: c.at.toISOString(),
      token: await createTestToken("governance-workflow-test", {
        employeeId: person.employeeId,
        accountId: person.accountId,
      }),
    })
  }
  const submit = async (amount = 500) =>
    request(0, "/company/application-requests", {
      template_code: "governance_test",
      payload: { amount },
    })
  const voidAssignment = async () => {
    const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
    if (assignment === undefined) throw new Error("assignment is missing")
    await c.write([{ ...assignment, revision: 2, state: "void" }])
  }
  return { ...c, request, submit, voidAssignment }
}

describe("公開Company規程を使う申請API", () => {
  test.each(["approve", "reject"])(
    "合議の否定票は成立可能性に従って処理する: %s",
    async (action) => {
      const canApprove = action === "approve"
      const c = await createFixture()
      const number = z.object({ id: z.number() }).parse(await (await c.submit()).json()).id
      expect(
        (
          await c.request(1, `/company/application-requests/${number}/reject`, {
            comment: "Against",
          })
        ).status,
      ).toBe(200)
      expect(
        await c.database.prepare("SELECT status FROM system_cases").first<string>("status"),
      ).toBe("pending")
      expect(
        (
          await c.request(2, `/company/application-requests/${number}/${action}`, {
            comment: "Vote",
          })
        ).status,
      ).toBe(200)
      if (canApprove) {
        expect(
          await c.database.prepare("SELECT status FROM system_cases").first<string>("status"),
        ).toBe("pending")
        expect(
          (await c.request(3, `/company/application-requests/${number}/approve`, { comment: null }))
            .status,
        ).toBe(200)
      }
      expect(
        await c.database.prepare("SELECT status FROM system_cases").first<string>("status"),
      ).toBe(canApprove ? "approved" : "rejected")
    },
  )

  test("実際の申請から合議Taskを作り、二名の確認で承認する", async () => {
    const c = await createFixture()
    const submitted = await c.submit()
    expect({ status: submitted.status, body: await submitted.clone().json() }).toMatchObject({
      status: 201,
    })
    const number = z.object({ id: z.number() }).parse(await submitted.json()).id
    expect(
      await c.database
        .prepare(
          "SELECT required_approvals, required_participants, delegation_policy, return_policy FROM system_decision_tasks",
        )
        .first<{
          required_approvals: number
          required_participants: number
          delegation_policy: string
          return_policy: string
        }>(),
    ).toEqual({
      required_approvals: 2,
      required_participants: 2,
      delegation_policy: "forbidden",
      return_policy: "forbidden",
    })
    expect(
      (await c.request(0, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(403)
    const first = await c.request(1, `/company/application-requests/${number}/approve`, {
      comment: null,
    })
    expect(first.status).toBe(200)
    expect(
      await c.database.prepare("SELECT status FROM system_cases").first<string>("status"),
    ).toBe("pending")
    expect(
      (await c.request(2, `/company/application-requests/${number}/approve`, { comment: null }))
        .status,
    ).toBe(200)
    expect(
      await c.database.prepare("SELECT status FROM system_cases").first<string>("status"),
    ).toBe("approved")
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(2)
  })

  test("規程の金額範囲外では申請を作成しない", async () => {
    const c = await createFixture()
    expect((await c.submit(1001)).status).toBe(422)
    expect(
      await c.database.prepare("SELECT count(*) AS total FROM system_cases").first<number>("total"),
    ).toBe(0)
  })

  test.each(["authority", "quorum"])(
    "提出後の資格・決議条件の変更を再検査する: %s",
    async (change) => {
      const c = await createFixture()
      const number = z.object({ id: z.number() }).parse(await (await c.submit()).json()).id
      if (change === "authority") await c.voidAssignment()
      else {
        const body = c.resources.find((resource) => resource.type === "collective-body")
        if (body === undefined) throw new Error("collective body is missing")
        await c.write([
          {
            ...body,
            revision: 2,
            attributes: { ...body.attributes, quorumValue: 3, decisionRule: "unanimity" },
          },
        ])
      }
      expect(
        (await c.request(1, `/company/application-requests/${number}/approve`, { comment: null }))
          .status,
      ).toBe(403)
      expect(
        await c.database
          .prepare("SELECT required_approvals FROM system_decision_tasks")
          .first<number>("required_approvals"),
      ).toBe(2)
      expect(
        await c.database
          .prepare("SELECT count(*) AS total FROM system_human_attestations")
          .first<number>("total"),
      ).toBe(0)
    },
  )

  test("候補解決後に責務が取り消される競合では提案とTaskを保存しない", async () => {
    const c = await createFixture()
    const interception = spyOn(SystemD1WorkflowAdapter.prototype, "start").mockImplementationOnce(
      async function (this: SystemD1WorkflowAdapter, input) {
        interception.mockRestore()
        await c.voidAssignment()
        return this.start(input)
      },
    )
    try {
      expect((await c.submit()).status).toBe(409)
    } finally {
      interception.mockRestore()
    }
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM system_proposals")
        .first<number>("total"),
    ).toBe(0)
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM system_decision_tasks")
        .first<number>("total"),
    ).toBe(0)
  })
})
