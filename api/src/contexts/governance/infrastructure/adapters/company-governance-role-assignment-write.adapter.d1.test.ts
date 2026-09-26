import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createLocalD1CompanyAssignment } from "@tests/d1/support/create-local-d1-company-assignment"
import { CompanyGovernanceRoleAssignmentReadAdapter } from "@/contexts/governance/infrastructure/adapters/company-governance-role-assignment-read.adapter"
import { CompanyGovernanceRoleAssignmentWriteAdapter } from "@/contexts/governance/infrastructure/adapters/company-governance-role-assignment-write.adapter"
import { CreateRecordSourceFreeze } from "@system/application/records/create-record-source-freeze"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(5)
})

afterAll(async () => {
  await pool.dispose()
})

async function fixture() {
  const context = await createLocalD1CompanyAssignment(await pool.next())
  await context.assignEmployeeCode()
  const actor = CompanyActorValue.restore({
    accountId: context.creator.accountId,
    employeeId: context.creator.employeeId,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:admin"],
  })
  return {
    ...context,
    writer: new CompanyGovernanceRoleAssignmentWriteAdapter({
      actor,
      database: context.database,
      auditStatements: [],
    }),
  }
}

test("責務定義と任命を一つの会社版へ保存し、同じcommandを同じ結果へ再送する", async () => {
  const f = await fixture()
  const expectedRevision = await f.companyRevision()
  const input = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    commandId: "governance:ciso:first",
    expectedRevision,
    responsibilityCode: "ciso",
    responsibilityName: "CISO",
    cardinality: "one" as const,
    employeeCode: "EMPLOYEE-001",
    departmentCode: null,
    startsOn: restoreCalendarDate("2030-03-01"),
    endsOn: null,
    sourceDocumentCode: "policy.security",
    recordedAt: f.at.getTime(),
  }
  const first = await f.writer.assign(input)
  expect(first).toMatchObject({ kind: "assigned", replayed: false })
  if (first.kind !== "assigned") throw new Error(`assignment failed: ${first.kind}`)
  const replay = await f.writer.assign(input)
  expect(replay).toEqual({ ...first, replayed: true })

  const read = await new CompanyGovernanceRoleAssignmentReadAdapter({
    repository: new D1CompanyResourceRepository({ database: f.database }),
  }).read({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    responsibilityCode: "ciso",
    effectiveOn: restoreCalendarDate("2030-03-01"),
    organizationRevision: first.organizationRevision,
  })
  expect(read).toMatchObject({
    organizationRevision: first.organizationRevision,
    assignees: [{ assignmentId: first.assignmentId, employeeCode: "EMPLOYEE-001" }],
  })
  expect(
    await f.database
      .prepare(
        "SELECT reason FROM company_resource_revisions WHERE resource_type = 'responsibility-assignment' AND resource_id = ?1",
      )
      .bind(first.assignmentId)
      .first<string>("reason"),
  ).toBe("Assign ciso responsibility from policy.security")
})

test("単独責務の期間重複を別のCompany commandとして保存しない", async () => {
  const f = await fixture()
  const first = await f.writer.assign({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    commandId: "governance:ciso:first",
    expectedRevision: await f.companyRevision(),
    responsibilityCode: "ciso",
    responsibilityName: "CISO",
    cardinality: "one",
    employeeCode: "EMPLOYEE-001",
    departmentCode: null,
    startsOn: restoreCalendarDate("2030-03-01"),
    endsOn: null,
    sourceDocumentCode: null,
    recordedAt: f.at.getTime(),
  })
  if (first.kind !== "assigned") throw new Error(`assignment failed: ${first.kind}`)
  const before = await f.companyRevision()
  const overlap = await f.writer.assign({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    commandId: "governance:ciso:overlap",
    expectedRevision: before,
    responsibilityCode: "ciso",
    responsibilityName: "CISO",
    cardinality: "one",
    employeeCode: "EMPLOYEE-001",
    departmentCode: null,
    startsOn: restoreCalendarDate("2030-04-01"),
    endsOn: null,
    sourceDocumentCode: null,
    recordedAt: f.at.getTime(),
  })
  expect(overlap).toEqual({ kind: "overlap" })
  expect(await f.companyRevision()).toBe(before)
})

test("解除をCompanyの取消revisionとして残し、同じcommandの再送で履歴を増やさない", async () => {
  const f = await fixture()
  const assigned = await f.writer.assign({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    commandId: "governance:ciso:first",
    expectedRevision: await f.companyRevision(),
    responsibilityCode: "ciso",
    responsibilityName: "CISO",
    cardinality: "one",
    employeeCode: "EMPLOYEE-001",
    departmentCode: null,
    startsOn: restoreCalendarDate("2030-03-01"),
    endsOn: null,
    sourceDocumentCode: null,
    recordedAt: f.at.getTime(),
  })
  if (assigned.kind !== "assigned") throw new Error(`assignment failed: ${assigned.kind}`)
  const input = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    commandId: "governance:ciso:revoke",
    expectedRevision: assigned.organizationRevision,
    assignmentId: assigned.assignmentId,
    recordedAt: f.at.getTime(),
  }
  const revoked = await f.writer.revoke(input)
  expect(revoked).toMatchObject({ kind: "revoked", replayed: false })
  if (revoked.kind !== "revoked") throw new Error(`revocation failed: ${revoked.kind}`)
  expect(await f.writer.revoke(input)).toEqual({ ...revoked, replayed: true })
  expect(
    await f.database
      .prepare(
        "SELECT revision, state FROM company_resource_revisions WHERE resource_type = 'responsibility-assignment' AND resource_id = ?1 ORDER BY revision",
      )
      .bind(assigned.assignmentId)
      .all(),
  ).toMatchObject({
    results: [
      { revision: 1, state: "active" },
      { revision: 2, state: "void" },
    ],
  })
})

test("監査保存が失敗した場合はCompanyの責務任命も会社版も保存しない", async () => {
  const f = await fixture()
  const before = await f.companyRevision()
  const writer = new CompanyGovernanceRoleAssignmentWriteAdapter({
    actor: CompanyActorValue.restore({
      accountId: f.creator.accountId,
      employeeId: f.creator.employeeId,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:admin"],
    }),
    database: f.database,
    auditStatements: [f.database.prepare("SELECT json_extract('', '$')")],
  })
  const result = await writer.assign({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    commandId: "governance:ciso:audit-failure",
    expectedRevision: before,
    responsibilityCode: "ciso",
    responsibilityName: "CISO",
    cardinality: "one",
    employeeCode: "EMPLOYEE-001",
    departmentCode: null,
    startsOn: restoreCalendarDate("2030-03-01"),
    endsOn: null,
    sourceDocumentCode: null,
    recordedAt: f.at.getTime(),
  })
  expect(result).toMatchObject({ kind: "unavailable" })
  expect(await f.companyRevision()).toBe(before)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS total FROM company_resource_revisions WHERE command_id = 'governance:ciso:audit-failure'",
      )
      .first<number>("total"),
  ).toBe(0)
})

test("取消済みの元記録をactiveとvoidの連続改訂および移行証跡として原子的に保存する", async () => {
  const f = await fixture()
  const freezeId = "24109d85-bc36-4077-809d-315717a0b07c"
  const sourceNamespace = "af0d9d64-9dd8-48d2-8e30-d67226e4d65a"
  const frozen = await new CreateRecordSourceFreeze({
    repository: openSystemRecordSourceFreezes({ env: f.context.env, assertions: [] }),
  }).execute(
    {
      id: freezeId,
      sourceNamespace,
      ownerContext: "governance",
      actorAccountId: f.creator.accountId,
      reason: "Freeze legacy responsibility for atomic adoption test",
    },
    f.at,
  )
  if (frozen instanceof Error || frozen === "conflict") throw new Error("freeze failed")
  const adoptionRequest: Parameters<CompanyGovernanceRoleAssignmentWriteAdapter["assign"]>[0] = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    commandId: "governance:legacy:7",
    expectedRevision: await f.companyRevision(),
    responsibilityCode: "ciso",
    responsibilityName: "CISO",
    cardinality: "one",
    employeeCode: "EMPLOYEE-001",
    departmentCode: null,
    startsOn: restoreCalendarDate("2025-01-01"),
    endsOn: null,
    sourceDocumentCode: null,
    recordedAt: f.at.getTime(),
    voided: true,
    additionalPayload: { sourceNamespace, freezeId, sourceId: "7", snapshotDigest: "0".repeat(64) },
    prepareAdditionalStatements: (assignment) => [
      f.database
        .prepare(`INSERT INTO company_responsibility_source_adoptions
          (organization_id, source_context, source_kind, source_namespace, freeze_id,
           source_id, source_version,
           command_id, resource_type, resource_id, resource_revision, snapshot_digest,
           source_json, actor_account_id, reason, expected_revision, organization_revision,
           recorded_at)
         VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'governance', 'org-role-assignment', ?1, ?2,
           '7', ?3, ?4, 'responsibility-assignment', ?5, ?6, ?3, ?7, ?8, ?9, ?10, ?11, ?12)`)
        .bind(
          sourceNamespace,
          freezeId,
          "0".repeat(64),
          "governance:legacy:7",
          assignment.assignmentId,
          assignment.resourceRevision,
          JSON.stringify({ id: 7, revokedAt: "2025-02-01T00:00:00Z" }),
          assignment.actorAccountId,
          assignment.reason,
          assignment.expectedRevision,
          assignment.organizationRevision,
          assignment.recordedAt,
        ),
    ],
  }
  const result = await f.writer.assign(adoptionRequest)
  expect(result).toMatchObject({ kind: "assigned", replayed: false })
  if (result.kind !== "assigned") throw new Error(`adoption failed: ${result.kind}`)
  expect(
    await f.database
      .prepare(
        "SELECT revision, state FROM company_resource_revisions WHERE resource_id = ?1 ORDER BY revision",
      )
      .bind(result.assignmentId)
      .all(),
  ).toMatchObject({
    results: [
      { revision: 1, state: "active" },
      { revision: 2, state: "void" },
    ],
  })
  expect(
    await f.database
      .prepare("SELECT resource_revision FROM company_responsibility_source_adoptions")
      .first<number>("resource_revision"),
  ).toBe(2)
  expect(await f.writer.assign(adoptionRequest)).toEqual({ ...result, replayed: true })
  expect(
    await f.writer.assign({
      ...adoptionRequest,
      additionalPayload: {
        sourceNamespace,
        freezeId: "different-freeze",
        sourceId: "7",
        snapshotDigest: "0".repeat(64),
      },
    }),
  ).toEqual({ kind: "command_conflict" })
})
