import { PrepareCompanyRecordDecisionReplayAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-decision-replay.adapter"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { expect, test } from "bun:test"
import { z } from "zod"
import { createLicensePreservationFixture } from "@/contexts/software-license/test/create-license-preservation-fixture.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { findSystemPreservedRecordExecutionProof } from "@system/interface/operations/find-system-preserved-record-execution-proof"
import { prepareSystemPreservedRecordApprovalHistory } from "@system/interface/operations/prepare-system-preserved-record-approval-history"

test("代理承認で保存した記録は業務撤去後も委任条件を返し、後日の取消と当時の無効を区別する", async () => {
  // 最後に外部キーを外して委任を消し、参照先の欠けた承認履歴を拒否することを確かめる。
  // D1は外部キーの検査を外せず、この状態を作れないため、移行を終えるまで互換DBで検証する。
  const fixture = await createLicensePreservationFixture(createD1TestDatabase(loadSchema()))
  const delegate = fixture.governance.people.find(
    (person) => person.accountId !== fixture.reviewer.accountId,
  )
  if (delegate === undefined) throw new Error("delegate missing")
  const database = fixture.f.database
  const assignment = fixture.governance.resources.find(
    (resource) => resource.type === "responsibility-assignment",
  )
  if (assignment === undefined || assignment.type !== "responsibility-assignment")
    throw new Error("assignment missing")
  await fixture.governance.write([
    {
      ...assignment,
      revision: 3,
      attributes: {
        ...assignment.attributes,
        holderType: "employee",
        holderId: fixture.reviewer.employeeId,
        authorityScopeId: null,
        delegationAllowed: true,
      },
    },
  ])
  await database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('7a047d56-30bc-4028-888d-2294d2d80c99','system:record:preserve')",
  )
  const submitted = await fixture.f.request(fixture.path, fixture.command)
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), case_id: z.string(), record_id: z.string() })
    .parse(await submitted.json())
  const target = await database
    .prepare(`SELECT c.proposal_digest,t.task_key,t.round
    FROM system_cases c JOIN system_decision_tasks t ON t.case_id=c.id WHERE c.id=?1`)
    .bind(receipt.case_id)
    .first<{ proposal_digest: string; task_key: string; round: number }>()
  if (target === null) throw new Error("decision target missing")
  const startsAt = Date.now() - 1000
  const endsAt = startsAt + 600000
  await database
    .prepare(`INSERT INTO system_delegations
    (id,delegator_account_id,delegate_account_id,scope_context,scope_kind,scope_id,scope_version,starts_at,ends_at,created_at,revoked_at)
    VALUES ('ca75018e-54c6-492a-803a-c192354d33b4',?1,?4,NULL,NULL,NULL,NULL,?2,?3,?2,NULL)`)
    .bind(fixture.reviewer.accountId, startsAt, endsAt, delegate.accountId)
    .run()
  await database
    .prepare(
      "INSERT INTO system_delegation_procedure_scopes(delegation_id,procedure_key) VALUES ('ca75018e-54c6-492a-803a-c192354d33b4',?1)",
    )
    .bind(fixture.definition.key)
    .run()
  const approved = await fixture.f.request(`${fixture.path}/${receipt.number}/approve`, {
    method: "POST",
    accountId: delegate.accountId,
    body: {
      comment: "Acting under delegation",
      decision_target: {
        proposal_version: 1,
        proposal_digest: target.proposal_digest,
        task_key: target.task_key,
        task_round: target.round,
      },
    },
  })
  expect({ status: approved.status, body: await approved.json() }).toEqual({
    status: 200,
    body: { status: "approved" },
  })
  expect(
    (
      await fixture.f.request(`${fixture.path}/${receipt.number}/execute`, {
        method: "POST",
        body: { proposal_digest: target.proposal_digest },
      })
    ).status,
  ).toBe(200)
  await database.exec(
    "DROP TABLE software_license_assignments; DROP TABLE software_license_changes; DROP TABLE software_licenses;",
  )
  const context = { env: { DB: database } }
  const proof = await findSystemPreservedRecordExecutionProof(
    {
      ...context,
      assertions: [database.prepare("SELECT 1")],
    },
    receipt.record_id,
  )
  if (proof === null || proof instanceof Error)
    throw new Error("execution proof missing", { cause: proof })
  const readerContext = context
  const input = {
    proof,
    accountId: "account:manager",
    permissionKeys: new Set(["system:procedure:read"]),
    at: new Date(),
  }
  const history = await prepareSystemPreservedRecordApprovalHistory(readerContext, input)
  if (history instanceof Error) throw history
  expect(history.attestations).toMatchObject([
    {
      actorAccountId: delegate.accountId,
      representedAccountId: fixture.reviewer.accountId,
      delegationId: "ca75018e-54c6-492a-803a-c192354d33b4",
    },
  ])
  expect(history.delegations).toEqual([
    {
      id: "ca75018e-54c6-492a-803a-c192354d33b4",
      delegatorAccountId: fixture.reviewer.accountId,
      delegateAccountId: delegate.accountId,
      scope: null,
      procedureKey: fixture.definition.key,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      createdAt: new Date(startsAt),
      revokedAt: null,
    },
  ])
  await database.batch([history.delegationsGuard])
  const decision = history.attestations[0]
  if (decision === undefined) throw new Error("attestation missing")
  const replayProposal = await openSystemProposals({
    env: { DB: database },
    visibleCompletionOperationKeys: ["system.record.preserve"],
  }).findByNumber(receipt.number)
  if (replayProposal instanceof Error || replayProposal === null)
    throw new Error("replay proposal missing")
  const replayQualification = new PrepareCompanyRecordDecisionReplayAdapter(
    fixture.governance.context,
  )
  const qualifiedReplay = await replayQualification.prepare({
    proposal: replayProposal,
    attestation: decision,
    at: new Date(),
  })
  expect(qualifiedReplay).not.toBeInstanceOf(Error)
  await database
    .prepare(`INSERT INTO system_delegations
    (id,delegator_account_id,delegate_account_id,scope_context,scope_kind,scope_id,scope_version,starts_at,ends_at,created_at,revoked_at)
    VALUES ('2f8b1b1c-5d9f-4ea5-8ec8-9fbbce85bd4d',?1,?2,NULL,NULL,NULL,NULL,?3,?4,?3,NULL)`)
    .bind(fixture.reviewer.accountId, delegate.accountId, startsAt + 1, endsAt)
    .run()
  expect(
    await replayQualification.prepare({
      proposal: replayProposal,
      attestation: decision,
      at: new Date(),
    }),
  ).not.toBeInstanceOf(Error)
  await database
    .prepare(
      "UPDATE system_delegations SET revoked_at=?1 WHERE id='ca75018e-54c6-492a-803a-c192354d33b4'",
    )
    .bind(decision.decidedAt.getTime() + 1)
    .run()
  expect(
    await database.batch([history.delegationsGuard]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(
    await replayQualification.prepare({
      proposal: replayProposal,
      attestation: decision,
      at: new Date(),
    }),
  ).toBeInstanceOf(Error)
  const afterRevocation = await prepareSystemPreservedRecordApprovalHistory(readerContext, input)
  if (afterRevocation instanceof Error) throw afterRevocation
  expect(afterRevocation.delegations[0]?.revokedAt).toEqual(
    new Date(decision.decidedAt.getTime() + 1),
  )
  await database.exec("DROP TRIGGER system_delegations_monotonic_lifecycle")
  await database
    .prepare(
      "UPDATE system_delegations SET revoked_at=?1 WHERE id='ca75018e-54c6-492a-803a-c192354d33b4'",
    )
    .bind(decision.decidedAt.getTime())
    .run()
  expect(await prepareSystemPreservedRecordApprovalHistory(readerContext, input)).toBeInstanceOf(
    Error,
  )
  await database
    .prepare(
      "UPDATE system_delegations SET revoked_at=NULL,ends_at=?1 WHERE id='ca75018e-54c6-492a-803a-c192354d33b4'",
    )
    .bind(decision.decidedAt.getTime())
    .run()
  expect(await prepareSystemPreservedRecordApprovalHistory(readerContext, input)).toBeInstanceOf(
    Error,
  )
  await database
    .prepare(
      "UPDATE system_delegations SET ends_at=?1 WHERE id='ca75018e-54c6-492a-803a-c192354d33b4'",
    )
    .bind(endsAt)
    .run()
  await database.exec("DROP TRIGGER system_delegation_procedure_scopes_prevent_delete")
  await database.exec(
    "DELETE FROM system_delegation_procedure_scopes WHERE delegation_id='ca75018e-54c6-492a-803a-c192354d33b4'",
  )
  expect(
    await database.batch([history.delegationsGuard]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  await database
    .prepare(
      "UPDATE system_delegations SET scope_context='system',scope_kind='record-preservation',scope_id=?1,scope_version='1' WHERE id='ca75018e-54c6-492a-803a-c192354d33b4'",
    )
    .bind(receipt.record_id)
    .run()
  const scoped = await prepareSystemPreservedRecordApprovalHistory(readerContext, input)
  if (scoped instanceof Error) throw scoped
  expect(scoped.delegations[0]?.scope).toEqual({
    context: "system",
    kind: "record-preservation",
    id: receipt.record_id,
    version: "1",
  })
  await database.exec(
    "UPDATE system_delegations SET scope_id='different-record' WHERE id='ca75018e-54c6-492a-803a-c192354d33b4'",
  )
  expect(await prepareSystemPreservedRecordApprovalHistory(readerContext, input)).toBeInstanceOf(
    Error,
  )
  await database.exec(
    "PRAGMA foreign_keys=OFF; DROP TRIGGER system_delegations_prevent_delete; DELETE FROM system_delegations WHERE id='ca75018e-54c6-492a-803a-c192354d33b4';",
  )
  expect(await prepareSystemPreservedRecordApprovalHistory(readerContext, input)).toBeInstanceOf(
    Error,
  )
})
