import { testDerivedId } from "@system/test/system-test-id.test-support"
import { createLicenseFixture } from "@/contexts/software-license/test/create-license-fixture.test-support"
import { createLocalD1Governance } from "@tests/d1/support/create-local-d1-governance"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

export async function createLicensePreservationFixture(
  database: D1Database,
  rejectionBehavior: "reject" | "return" = "reject",
  hasSecondStep = false,
) {
  const governance = await createLocalD1Governance(database)
  const f = await createLicenseFixture(database)
  const reviewer = governance.people.find(
    (person) => person.accountId !== testDerivedId("account", "manager"),
  )
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
  const step: typeof governance.step = {
    ...governance.step,
    rejection_behavior: rejectionBehavior,
    governance_authority: {
      organization_id: COMPANY_DEFAULT_ORGANIZATION_ID,
      responsibility_code: "APPROVE",
      scope: null,
    },
  }
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: {
      version: 1,
      steps: [step, ...(hasSecondStep ? [{ ...step, key: "second-review" }] : [])],
    },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: "record-preservation",
    revision: 1,
    title: "Preserve records",
    category: "system",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "system.record.preserve",
    createdByAccountId: governance.creator.accountId,
    createdAt: governance.at,
  })
  if (definition instanceof Error) throw definition
  const published = await openSystemProcedures(governance.context).publish(definition, 0)
  if (published !== true) throw published
  const bucket = new SystemAttachmentTestBucket()
  f.settings.liveClock = true
  f.settings.recordSourceNamespace = "example-source"
  f.settings.recordStorage = {
    ATTACHMENTS: bucket as unknown as R2Bucket,
    ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
  }
  const path = `/software-licenses/${f.license.id}/preservation-requests`
  const conditions = {
    reason: "Preserve original",
    preservation: { kind: "hold", retainUntil: null, reason: "Retain evidence" },
    disclosure: { reason: "Restricted archive", grants: [] },
  }
  const command = {
    method: "POST",
    headers: { "idempotency-key": crypto.randomUUID() },
    body: { procedure_key: definition.key, conditions },
  }
  return { f, governance, reviewer, definition, bucket, path, conditions, command }
}
