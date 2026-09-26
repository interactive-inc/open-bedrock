import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { zApplicationWorkflow } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { validateApplicationWorkflowReferences } from "@/api/http/procedure-workflows/validate-application-workflow-references"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["legacy-approvers", "legacy-escalation_approvers", "governance-authority"],
  })
})

afterAll(async () => {
  await local.dispose()
})

test.each(["approvers", "escalation_approvers"])(
  "旧責務指定を新しい定義へ保存できない: %s",
  async (field) => {
    const fixture = await createLocalD1Context(local, `legacy-${field}`)
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
  const fixture = await createLocalD1Context(local, "governance-authority")
  const workflow = zApplicationWorkflow.parse({
    version: 1,
    steps: [
      {
        key: "review",
        name: "Review",
        approvers: [],
        governance_authority: {
          organization_id: COMPANY_DEFAULT_ORGANIZATION_ID,
          responsibility_code: "REVIEWER",
          scope: null,
        },
      },
    ],
  })
  await validateApplicationWorkflowReferences(fixture.context, workflow)
  expect(workflow.steps[0]?.governance_authority?.responsibility_code).toBe("REVIEWER")
})
