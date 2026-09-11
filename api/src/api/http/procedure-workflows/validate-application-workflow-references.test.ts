import { expect, test } from "bun:test"
import { createTestContext } from "@tests/api/support/create-test-context"
import { zApplicationWorkflow } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { validateApplicationWorkflowReferences } from "@/api/http/procedure-workflows/validate-application-workflow-references"

test.each(["approvers", "escalation_approvers"])(
  "旧責務指定を新しい定義へ保存できない: %s",
  async (field) => {
    const fixture = await createTestContext()
    const workflow = zApplicationWorkflow.parse({
      version: 1,
      steps: [
        {
          key: "review",
          name: "Review",
          approvers: [{ type: "direct_manager" }],
          [field]: [{ type: "responsibility", responsibility_type: "REVIEWER" }],
        },
      ],
    })
    // 保存済み履歴の構文は読めても、新しい定義としての発行は拒否する。
    expect(workflow.steps[0]?.key).toBe("review")
    const rejected = await validateApplicationWorkflowReferences(fixture.context, workflow).then(
      () => null,
      (error: unknown) => error,
    )
    expect(rejected).toBeInstanceOf(Error)
    if (!(rejected instanceof Error)) throw new Error("expected rejection")
    expect(rejected.message).toContain("use governance_authority")
  },
)

test("公開責務による定義は発行できる", async () => {
  const fixture = await createTestContext()
  const workflow = zApplicationWorkflow.parse({
    version: 1,
    steps: [
      {
        key: "review",
        name: "Review",
        approvers: [],
        governance_authority: {
          organization_id: "organization:default",
          responsibility_code: "REVIEWER",
          scope: null,
        },
      },
    ],
  })
  await validateApplicationWorkflowReferences(fixture.context, workflow)
  expect(workflow.steps[0]?.governance_authority?.responsibility_code).toBe("REVIEWER")
})
