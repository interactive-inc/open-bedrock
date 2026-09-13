import { expect, test } from "bun:test"
import { z } from "zod"
import { createLicensePreservationFixture } from "@/contexts/software-license/test/create-license-preservation-fixture.test-support"
import { FindPreservedRecordExecutionProofAdapter } from "@system/infrastructure/adapters/records/find-preserved-record-execution-proof.adapter"
import { PreparePreservedRecordApprovalHistoryAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-approval-history.adapter"

test("代理承認で保存した記録は業務撤去後も委任条件を返し、後日の取消と当時の無効を区別する", async () => {
  const fixture = await createLicensePreservationFixture()
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
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
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
    VALUES ('record-delegation',?1,?4,NULL,NULL,NULL,NULL,?2,?3,?2,NULL)`)
    .bind(fixture.reviewer.accountId, startsAt, endsAt, delegate.accountId)
    .run()
  await database
    .prepare(
      "INSERT INTO system_delegation_procedure_scopes(delegation_id,procedure_key) VALUES ('record-delegation',?1)",
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
  const proof = await new FindPreservedRecordExecutionProofAdapter({
    ...context,
    assertions: [database.prepare("SELECT 1")],
  }).find(receipt.record_id)
  if (proof === null || proof instanceof Error)
    throw new Error("execution proof missing", { cause: proof })
  const reader = new PreparePreservedRecordApprovalHistoryAdapter(context)
  const input = {
    proof,
    accountId: "account:manager",
    permissionKeys: new Set(["system:procedure:read"]),
    at: new Date(),
  }
  const history = await reader.prepare(input)
  if (history instanceof Error) throw history
  expect(history.attestations).toMatchObject([
    {
      actorAccountId: delegate.accountId,
      representedAccountId: fixture.reviewer.accountId,
      delegationId: "record-delegation",
    },
  ])
  expect(history.delegations).toEqual([
    {
      id: "record-delegation",
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
  await database
    .prepare("UPDATE system_delegations SET revoked_at=?1 WHERE id='record-delegation'")
    .bind(decision.decidedAt.getTime() + 1)
    .run()
  expect(
    await database.batch([history.delegationsGuard]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  const afterRevocation = await reader.prepare(input)
  if (afterRevocation instanceof Error) throw afterRevocation
  expect(afterRevocation.delegations[0]?.revokedAt).toEqual(
    new Date(decision.decidedAt.getTime() + 1),
  )
  await database.exec("DROP TRIGGER system_delegations_monotonic_lifecycle")
  await database
    .prepare("UPDATE system_delegations SET revoked_at=?1 WHERE id='record-delegation'")
    .bind(decision.decidedAt.getTime())
    .run()
  expect(await reader.prepare(input)).toBeInstanceOf(Error)
  await database
    .prepare(
      "UPDATE system_delegations SET revoked_at=NULL,ends_at=?1 WHERE id='record-delegation'",
    )
    .bind(decision.decidedAt.getTime())
    .run()
  expect(await reader.prepare(input)).toBeInstanceOf(Error)
  await database
    .prepare("UPDATE system_delegations SET ends_at=?1 WHERE id='record-delegation'")
    .bind(endsAt)
    .run()
  await database.exec("DROP TRIGGER system_delegation_procedure_scopes_prevent_delete")
  await database.exec(
    "DELETE FROM system_delegation_procedure_scopes WHERE delegation_id='record-delegation'",
  )
  expect(
    await database.batch([history.delegationsGuard]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  await database
    .prepare(
      "UPDATE system_delegations SET scope_context='system',scope_kind='record-preservation',scope_id=?1,scope_version='1' WHERE id='record-delegation'",
    )
    .bind(receipt.record_id)
    .run()
  const scoped = await reader.prepare(input)
  if (scoped instanceof Error) throw scoped
  expect(scoped.delegations[0]?.scope).toEqual({
    context: "system",
    kind: "record-preservation",
    id: receipt.record_id,
    version: "1",
  })
  await database.exec(
    "UPDATE system_delegations SET scope_id='different-record' WHERE id='record-delegation'",
  )
  expect(await reader.prepare(input)).toBeInstanceOf(Error)
  await database.exec(
    "PRAGMA foreign_keys=OFF; DROP TRIGGER system_delegations_prevent_delete; DELETE FROM system_delegations WHERE id='record-delegation';",
  )
  expect(await reader.prepare(input)).toBeInstanceOf(Error)
})
