import { app } from "@/api/app"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { createLocalD1Governance } from "@tests/d1/support/create-local-d1-governance"
import { execSql } from "@tests/d1/support/exec-sql"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { createMonotonicTestClock } from "@tests/api/support/create-monotonic-test-clock"

const secret = "disciplinary-action-integration-test-secret"

/** 実System・Companyと懲戒記録原記録を接続する保全fixture。 */
export async function createDisciplinaryActionPreservationFixture(database: D1Database) {
  const governance = await createLocalD1Governance(database)
  const creator = governance.creator
  const reviewer = governance.people.find((person) => person.accountId !== creator.accountId)
  const assignment = governance.resources.find(
    (resource) => resource.type === "responsibility-assignment",
  )
  if (!reviewer || !assignment) throw new Error("missing Company approval fixture")
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
          rejection_behavior: "reject",
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
    key: "disciplinary-action-preservation",
    revision: 1,
    title: "Preserve disciplinary-actions",
    category: "system",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "system.record.preserve",
    createdByAccountId: creator.accountId,
    createdAt: governance.at,
  })
  if (definition instanceof Error) throw definition
  if ((await openSystemProcedures(governance.context).publish(definition, 0)) !== true)
    throw new Error("failed to publish preservation procedure")
  await execSql(
    database,
    `INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('c5e1fefb-5d63-4cfa-8b79-4afeb33f1bcb','disciplinary-action:test-manager','custom','DisciplinaryAction manager',0,0);
    INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES
      ('c5e1fefb-5d63-4cfa-8b79-4afeb33f1bcb','disciplinary_action:manage'),
      ('c5e1fefb-5d63-4cfa-8b79-4afeb33f1bcb','system:admin'),
      ('c5e1fefb-5d63-4cfa-8b79-4afeb33f1bcb','system:record:preserve'),
      ('c5e1fefb-5d63-4cfa-8b79-4afeb33f1bcb','system:record:read'),
      ('c5e1fefb-5d63-4cfa-8b79-4afeb33f1bcb','system:procedure:read');
    INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
    VALUES ('b9cc6a34-734e-43fd-8a1d-be2c36841145','${creator.accountId}','c5e1fefb-5d63-4cfa-8b79-4afeb33f1bcb',0);`,
  )
  const bucket = new SystemAttachmentTestBucket()
  const settings = {
    recordSourceNamespace: "example-source",
    recordStorage: {
      ATTACHMENTS: bucket as unknown as R2Bucket,
      ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
    },
  }
  const clock = createMonotonicTestClock()
  const bindings = {
    get NOW() {
      return clock().toISOString()
    },
    DB: database,
    JWT_SECRET: secret,
    PEPPER_SECRET: "disciplinary-action-pagination-test-pepper",
    RECORD_SOURCE_NAMESPACE: settings.recordSourceNamespace,
    COMPANY_TIME_ZONE: "Asia/Tokyo",
    ...settings.recordStorage,
  }
  const tokenFor = async (accountId: string) => {
    const token = await new SystemAccessTokenIssuer(secret).issue({
      accountId: zAccountId.parse(accountId),
      tokenVersion: 0,
      now: clock(),
    })
    if (token instanceof Error) throw token
    return token
  }
  const request = async (
    path: string,
    options: Readonly<{
      method?: string
      body?: unknown
      accountId?: string
      headers?: Record<string, string>
    }> = {},
  ) => {
    const token = await tokenFor(options.accountId ?? creator.accountId)
    return app.request(
      path,
      {
        method: options.method ?? "GET",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      },
      bindings,
    )
  }
  return {
    clock,
    database,
    governance,
    creator,
    reviewer,
    definition,
    settings,
    bindings,
    tokenFor,
    request,
  }
}
