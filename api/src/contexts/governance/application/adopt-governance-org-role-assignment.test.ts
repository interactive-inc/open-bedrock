import { AdoptGovernanceOrgRoleAssignment } from "@/contexts/governance/application/adopt-governance-org-role-assignment"
import { FinalizeGovernanceResponsibilityCutover } from "@/contexts/governance/application/finalize-governance-responsibility-cutover"
import { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { GovernanceRoleAssignmentAdoptionSnapshotAdapter } from "@/contexts/governance/infrastructure/adapters/governance-role-assignment-adoption-snapshot.adapter"
import { GovernanceOrgRoleAssignmentAdoptionAdapter } from "@/contexts/governance/infrastructure/adapters/governance-org-role-assignment-adoption.adapter"
import { GovernanceResponsibilityCutoverAdapter } from "@/contexts/governance/infrastructure/adapters/governance-responsibility-cutover.adapter"
import { CreateRecordSourceFreeze } from "@system/application/records/create-record-source-freeze"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { expect, test } from "bun:test"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"

async function fixture() {
  const context = await createCompanyAssignmentResourceTestContext(
    createD1TestDatabase(loadSchema()),
  )
  await context.assignEmployeeCode(context.creator.employeeId, "LEGACY-001")
  await context.database
    .prepare(`INSERT INTO governance_org_role_assignments
      (id, org_role_code, employee_id, department_code, starts_on, ends_on,
       source_document_code, created_by_account_id, created_at, revoked_by_account_id, revoked_at)
      VALUES (7, 'ciso', ?2, NULL, '2025-01-01', NULL,
       'security-policy', ?1, '2025-01-02T00:00:00Z', ?1, '2025-02-01T00:00:00Z')`)
    .bind(context.creator.accountId, context.creator.employeeId)
    .run()
  const freeze = await new CreateRecordSourceFreeze({
    repository: openSystemRecordSourceFreezes({
      env: context.context.env,
      assertions: [],
    }),
  }).execute(
    {
      id: "95ee3345-4f0e-4742-949a-c105bcb13b38",
      sourceNamespace: "9664c95f-412f-472f-9e09-9772f55485e1",
      ownerContext: "governance",
      actorAccountId: context.creator.accountId,
      reason: "Freeze governance responsibility assignments for adoption",
    },
    context.at,
  )
  if (freeze instanceof Error || freeze === "conflict") throw new Error("freeze failed")
  const session = new CompanySessionValue({
    accountId: context.creator.accountId,
    employeeId: context.creator.employeeId,
    employmentStatus: "ACTIVE",
    permissions: new Set(["governance:manage"]),
    roleKeys: [],
  })
  const adapter = new GovernanceOrgRoleAssignmentAdoptionAdapter({
    database: context.database,
    now: context.at.getTime(),
    timeZone: "Asia/Tokyo",
    sourceNamespace: "9664c95f-412f-472f-9e09-9772f55485e1",
    prepareAudit: (audit) => [
      context.database
        .prepare(`INSERT INTO system_audit_events
          (event_id, actor_account_id, action, target_type, target_id, outcome, occurred_at,
           metadata_json)
         VALUES (?1, ?2, ?3, ?4, ?5, 'succeeded', ?6, ?7)`)
        .bind(
          crypto.randomUUID(),
          audit.session.accountId,
          audit.action,
          audit.targetType,
          audit.targetId,
          context.at.getTime(),
          JSON.stringify(audit.metadata ?? null),
        ),
    ],
  })
  const application = new AdoptGovernanceOrgRoleAssignment({
    adopt: (props) => adapter.execute(props),
  })
  const snapshot = await new GovernanceRoleAssignmentAdoptionSnapshotAdapter({
    database: context.database,
    now: context.at.getTime(),
    timeZone: "Asia/Tokyo",
  }).find(7)
  if (snapshot === null || snapshot instanceof Error)
    throw new Error("snapshot failed", { cause: snapshot })

  return { ...context, application, session, snapshot }
}

test("凍結した取消済み割当を元記録とCompanyのactive・void履歴へ接続する", async () => {
  const context = await fixture()
  const expectedRevision = await context.companyRevision()
  const adopted = await context.application.execute({
    session: context.session,
    assignmentId: 7,
    freezeId: "95ee3345-4f0e-4742-949a-c105bcb13b38",
    commandId: "governance:adopt:7",
    expectedRevision,
    snapshotDigest: context.snapshot.snapshotDigest,
  })
  expect(adopted).toMatchObject({ kind: "assigned", replayed: false })
  if (!("kind" in adopted) || adopted.kind !== "assigned") throw new Error("adoption failed")
  expect(
    await context.database
      .prepare(
        "SELECT source_json, snapshot_digest, resource_revision, source_namespace, freeze_id FROM company_responsibility_source_adoptions",
      )
      .first<{
        source_json: string
        snapshot_digest: string
        resource_revision: number
        source_namespace: string
        freeze_id: string
      }>(),
  ).toEqual({
    source_json: context.snapshot.sourceJson,
    snapshot_digest: context.snapshot.snapshotDigest,
    resource_revision: 2,
    source_namespace: "9664c95f-412f-472f-9e09-9772f55485e1",
    freeze_id: "95ee3345-4f0e-4742-949a-c105bcb13b38",
  })
  expect(
    await context.database
      .prepare(
        "SELECT revision, state FROM company_resource_revisions WHERE resource_id = ?1 ORDER BY revision",
      )
      .bind(adopted.assignmentId)
      .all(),
  ).toMatchObject({
    results: [
      { revision: 1, state: "active" },
      { revision: 2, state: "void" },
    ],
  })
  expect(
    await context.application.execute({
      session: context.session,
      assignmentId: 7,
      freezeId: "95ee3345-4f0e-4742-949a-c105bcb13b38",
      commandId: "governance:adopt:7",
      expectedRevision,
      snapshotDigest: context.snapshot.snapshotDigest,
    }),
  ).toEqual({ ...adopted, replayed: true })
})

test("凍結前と異なる元記録ダイジェストでは会社版を進めない", async () => {
  const context = await fixture()
  const expectedRevision = await context.companyRevision()
  const rejected = await context.application.execute({
    session: context.session,
    assignmentId: 7,
    freezeId: "95ee3345-4f0e-4742-949a-c105bcb13b38",
    commandId: "governance:adopt:changed",
    expectedRevision,
    snapshotDigest: "0".repeat(64),
  })
  expect(rejected).toMatchObject({ code: "governance_role_source_conflict" })
  expect(await context.companyRevision()).toBe(expectedRevision)
  expect(
    await context.database
      .prepare("SELECT count(*) AS total FROM company_responsibility_source_adoptions")
      .first<number>("total"),
  ).toBe(0)
})

test("別の停止世代では旧責務をCompanyへ移行しない", async () => {
  const context = await fixture()
  const expectedRevision = await context.companyRevision()
  const rejected = await context.application.execute({
    session: context.session,
    assignmentId: 7,
    freezeId: "8144784c-529c-45b3-bb71-a5439a02b93a",
    commandId: "governance:adopt:wrong-freeze",
    expectedRevision,
    snapshotDigest: context.snapshot.snapshotDigest,
  })
  expect(rejected).toMatchObject({ code: "governance_role_source_not_frozen" })
  expect(await context.companyRevision()).toBe(expectedRevision)
})

test("停止世代の間は旧責任台帳の追加・更新・削除を全て拒否する", async () => {
  const context = await fixture()
  await expect(
    context.database
      .prepare(`INSERT INTO governance_org_role_assignments
        (org_role_code, employee_id, starts_on, created_by_account_id, created_at)
        VALUES ('privacy-manager', ?1, '2025-01-01', ?2, '2025-01-02T00:00:00Z')`)
      .bind(context.creator.employeeId, context.creator.accountId)
      .run(),
  ).rejects.toThrow("governance_org_role_assignment_source_frozen")
  await expect(
    context.database
      .prepare("UPDATE governance_org_role_assignments SET ends_on = '2025-03-01' WHERE id = 7")
      .run(),
  ).rejects.toThrow("governance_org_role_assignment_source_frozen")
  await expect(
    context.database.prepare("DELETE FROM governance_org_role_assignments WHERE id = 7").run(),
  ).rejects.toThrow("governance_org_role_assignment_source_frozen")
})

function cutoverApplication(context: Readonly<{ database: D1Database; at: Date }>) {
  const adapter = new GovernanceResponsibilityCutoverAdapter({
    database: context.database,
    now: context.at.getTime(),
    sourceNamespace: "9664c95f-412f-472f-9e09-9772f55485e1",
    prepareAudit: (audit) => {
      const eventId = crypto.randomUUID()
      return {
        eventId,
        statements: [
          context.database
            .prepare(`INSERT INTO company_audit_event_appends
              (event_id, request_id, actor_account_id, actor_employee_id, action,
               target_type, target_id, outcome, reason_code, authorization_json,
               before_json, after_json, metadata_json, client_ip, client_name, created_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'succeeded', NULL, NULL,
               NULL, NULL, ?8, NULL, 'api', ?9)`)
            .bind(
              eventId,
              crypto.randomUUID(),
              audit.session.accountId,
              audit.session.employeeId,
              audit.action,
              audit.targetType,
              audit.targetId,
              JSON.stringify(audit.metadata),
              Math.floor(context.at.getTime() / 1_000),
            ),
        ],
      }
    },
  })
  return new FinalizeGovernanceResponsibilityCutover({
    finalize: (props) => adapter.execute(props),
  })
}

test("全ての旧責務をCompanyへ接続した場合だけ廃止可能な完了証跡を固定する", async () => {
  const context = await fixture()
  const freezeId = "95ee3345-4f0e-4742-949a-c105bcb13b38"
  const incomplete = await cutoverApplication(context).execute({
    session: context.session,
    freezeId,
  })
  expect(incomplete).toMatchObject({ code: "governance_role_cutover_incomplete" })
  expect(
    await context.database
      .prepare("SELECT count(*) FROM company_responsibility_source_cutovers")
      .first<number>("count(*)"),
  ).toBe(0)

  const adopted = await context.application.execute({
    session: context.session,
    assignmentId: 7,
    freezeId,
    commandId: "governance:adopt:cutover:7",
    expectedRevision: await context.companyRevision(),
    snapshotDigest: context.snapshot.snapshotDigest,
  })
  expect(adopted).toMatchObject({ kind: "assigned" })

  const completed = await cutoverApplication(context).execute({
    session: context.session,
    freezeId,
  })
  expect(completed).toMatchObject({
    kind: "completed",
    replayed: false,
    freeze_id: freezeId,
    source_count: 1,
    adopted_count: 1,
  })
  expect(await cutoverApplication(context).execute({ session: context.session, freezeId })).toEqual(
    { ...completed, replayed: true },
  )
  await expect(
    context.database.prepare("DELETE FROM company_responsibility_source_cutovers").run(),
  ).rejects.toThrow("company_responsibility_source_cutover_immutable")
})
