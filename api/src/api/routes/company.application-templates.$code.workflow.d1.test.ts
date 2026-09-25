import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { zApplicationWorkflow } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["legacy-definition-reissue"],
  })
})

afterAll(async () => {
  await local.dispose()
})

test("旧定義は読めるが再発行できず、公開責務への明示的な変更だけが版を進める", async () => {
  const fixture = await createLocalD1Context(local, "legacy-definition-reissue", {
    withCompanyOrganization: true,
  })
  const workflow = zApplicationWorkflow.parse({
    version: 1,
    steps: [
      {
        key: "review",
        name: "Review",
        approvers: [{ type: "responsibility", responsibility_type: "REVIEWER" }],
      },
    ],
  })
  const policy = createCompanyProcedureDecisionPolicy({ approverRoles: [], workflow })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: "review",
    revision: 1,
    title: "Review",
    category: "test",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: null,
    createdByAccountId: zAccountId.parse("1"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  })
  if (definition instanceof Error) throw definition
  expect(await openSystemProcedures({ env: { DB: fixture.db } }).publish(definition, 0)).toBe(true)
  const token = await createTestToken("workflow-test-signing-secret", {
    employeeId: restoreWorkforceId("employee", "1"),
  })
  const request = (method: string, body?: unknown) =>
    requestWithContext({
      db: fixture.db,
      jwtSecret: "workflow-test-signing-secret",
      token,
      path: "/company/application-templates/review/workflow",
      method,
      body,
    })
  const before = await request("GET")
  expect(before.status).toBe(200)
  const original = await before.json()
  for (const field of ["approvers", "escalation_approvers"]) {
    const rejected = await request("PUT", {
      version: 1,
      expected_revision: 1,
      steps: [
        {
          key: "review",
          name: "Review",
          approvers: [{ type: "direct_manager" }],
          [field]: [{ type: "responsibility", responsibility_type: "REVIEWER" }],
        },
      ],
    })
    expect(rejected.status).toBe(422)
    expect(await rejected.text()).toContain("governance_authority")
    expect(await (await request("GET")).json()).toEqual(original)
  }
  const replaced = await request("PUT", {
    version: 1,
    expected_revision: 1,
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
  expect({ status: replaced.status, body: await replaced.json() }).toMatchObject({
    status: 200,
    body: { revision: 2 },
  })
  expect(
    await fixture.db
      .prepare("SELECT count(*) AS count FROM system_procedure_definition_revisions")
      .first<number>("count"),
  ).toBe(2)
})
