import { app } from "@/api/app"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"

/** 実認証、会社の期間付き責務、暗号化した保全本文を使う経費予算APIのfixture。 */
export async function createExpensePreservationFixture() {
  const governance = await createGovernanceTaskTestContext()
  const reviewer = governance.people[1]
  const assignment = governance.resources.find(
    (resource) => resource.type === "responsibility-assignment",
  )
  if (reviewer === undefined || assignment === undefined)
    throw new Error("missing approval fixture")
  await governance.write([
    {
      ...assignment,
      revision: 2,
      attributes: {
        ...assignment.attributes,
        holderType: "employee",
        holderId: reviewer.employeeId,
        authorityScopeId: null,
      },
    },
  ])
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: {
      version: 1,
      steps: [
        {
          ...governance.step,
          governance_authority: {
            organization_id: "organization:default",
            responsibility_code: "APPROVE",
            scope: null,
          },
        },
      ],
    },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: "expense-preservation",
    revision: 1,
    title: "Preserve expense",
    category: "system",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "system.record.preserve",
    createdByAccountId: governance.creator.accountId,
    createdAt: governance.at,
  })
  if (definition instanceof Error) throw definition
  const published = await new SystemD1ProcedureRepository(governance.context).publish(definition, 0)
  if (published !== true) throw published
  const database = governance.database
  await database.exec(`INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('role:expense-archive','expense:archive','custom','Archive operator',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('role:expense-archive','budget:manage');`)
  await database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
    VALUES ('binding:expense-archive',?1,'role:expense-archive',0)`)
    .bind(governance.creator.accountId)
    .run()
  await database.exec(`INSERT INTO expense_budgets
    (id,organization_unit_id,fiscal_period,period_start,period_end,amount,name,note,created_at)
    SELECT 1,id,'2026','2026-04-01','2027-03-31',100000,'Annual budget','Original note','2026-09-01T00:00:00Z'
    FROM company_organization_units LIMIT 1`)
  const bucket = new SystemAttachmentTestBucket()
  const secret = "expense-preservation-test-secret"
  const settings = { sourceNamespace: "example-source", disabledDefaultApps: "" }
  const keys = createSystemAttachmentTestKekEnvironment(1)
  const request = async (
    path: string,
    input: Readonly<{
      body?: unknown
      key?: string
      anonymous?: boolean
      accountId?: AccountId
      stepUp?: string
    }>,
  ) => {
    const token = await new SystemAccessTokenIssuer(secret).issue({
      accountId: input.accountId ?? governance.creator.accountId,
      tokenVersion: 0,
      now: new Date(),
    })
    if (token instanceof Error) throw token
    return app.request(
      path,
      {
        method: input.body === undefined ? "GET" : "POST",
        headers: {
          "content-type": "application/json",
          ...(input.anonymous ? {} : { authorization: `Bearer ${token}` }),
          ...(input.key === undefined ? {} : { "idempotency-key": input.key }),
          ...(input.stepUp === undefined ? {} : { "x-system-step-up": input.stepUp }),
        },
        body: JSON.stringify(input.body),
      },
      {
        DB: database,
        JWT_SECRET: secret,
        PEPPER_SECRET: "expense-preservation-test-pepper",
        AUDIT_HMAC_SECRET: "expense-preservation-test-audit",
        COMPANY_TIME_ZONE: "Asia/Tokyo",
        RECORD_SOURCE_NAMESPACE: settings.sourceNamespace,
        DISABLED_DEFAULT_APPS: settings.disabledDefaultApps,
        ATTACHMENTS: bucket,
        ATTACHMENT_KEKS: keys,
      },
    )
  }
  const conditions = {
    reason: "Preserve original",
    preservation: { kind: "hold", retainUntil: null, reason: "Retain evidence" },
    disclosure: { reason: "Restricted archive", grants: [] },
  }
  return {
    database,
    bucket,
    recordStorage: { ATTACHMENTS: bucket, ATTACHMENT_KEKS: keys },
    governance,
    reviewer,
    definition,
    settings,
    request,
    conditions,
    path: "/expense/records/expense-budget/1/preservation-requests",
    command: { key: crypto.randomUUID(), body: { procedure_key: definition.key, conditions } },
  }
}
