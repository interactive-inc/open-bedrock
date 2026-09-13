import { createLicenseFixture } from "@/contexts/software-license/test/create-license-fixture.test-support"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"

export async function createLicensePreservationFixture(
  rejectionBehavior: "reject" | "return" = "reject",
  hasSecondStep = false,
) {
  const governance = await createGovernanceTaskTestContext()
  const f = await createLicenseFixture(governance.database)
  const reviewer = governance.people.find((person) => person.accountId !== "account:manager")
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
      organization_id: "organization:default",
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
  const published = await new SystemD1ProcedureRepository(governance.context).publish(definition, 0)
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
