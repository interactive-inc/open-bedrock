import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createGovernancePreservationFixture } from "@/contexts/governance/test/create-governance-preservation-fixture.test-support"
import {
  encodeGovernanceRecordId,
  governanceRecordKinds,
} from "@/contexts/governance/domain/definitions/governance-record-kind.definition"
import { governanceSourceTables } from "@/contexts/governance/infrastructure/adapters/lib/governance-snapshot-query"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { GET as preservedDossier } from "@system/interface/routes/system.preserved-records.$recordId.dossier"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { drizzle } from "drizzle-orm/d1"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"
import { execSql } from "@tests/d1/support/exec-sql"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(1)
})

afterAll(async () => {
  await pool.dispose()
})

test("規程・ガバナンス8台帳を分割照合し撤去確定する", async () => {
  const { database, governance, creator, reviewer, definition, bindings, tokenFor, request } =
    await createGovernancePreservationFixture(await pool.next())
  for (let index = 0; index <= 10; index++) {
    const code = `cap-${String(index).padStart(2, "0")}`
    await database
      .prepare(`INSERT INTO governance_capabilities
      (code,name,description,owner_org_role_code,status,created_at,updated_at)
      VALUES (?1,?2,NULL,NULL,'active','2026-09-01','2026-09-01')`)
      .bind(code, `Capability ${index}`)
      .run()
  }
  await database
    .prepare(`INSERT INTO governance_acknowledgements
    (version_id,employee_id,content_hash,acknowledged_at)
    VALUES ('version:a',?1,?2,'2026-09-02')`)
    .bind(creator.employeeId, "a".repeat(64))
    .run()
  await execSql(
    database,
    `INSERT INTO governance_document_references
    (version_id,kind,code) VALUES ('version:a','capability','cap:ref');
    INSERT INTO governance_publication_approvals
    (version_id,org_role_code,status,decided_by_employee_id,decided_at,comment)
    VALUES ('version:a','role:a','pending',NULL,NULL,NULL);`,
  )
  const token = await tokenFor(creator.accountId)
  const stepUpToken = "f".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const now = new Date()
  await database
    .prepare(`INSERT INTO system_step_up_grants
      (id,account_id,token_hash,method,issued_at,expires_at)
      VALUES ('governance-coverage-step-up',?1,?2,'external_identity',?3,?4)`)
    .bind(creator.accountId, hash, now.getTime(), now.getTime() + 60_000)
    .run()
  const post = (path: string, body: unknown) =>
    app.request(
      path,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
          "x-system-step-up": stepUpToken,
        },
        body: JSON.stringify(body),
      },
      bindings,
    )
  const freezeId = crypto.randomUUID()
  const frozen = await app.request(
    "/governance/record-source-freezes",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": freezeId,
        "x-system-step-up": stepUpToken,
      },
      body: JSON.stringify({ reason: "Verify governance archive" }),
    },
    bindings,
  )
  if (frozen.status !== 201) throw new Error(await frozen.text())
  const mappings = new Map<string, Array<{ sourceRecordId: string; preservedRecordId: string }>>()
  for (const kind of governanceRecordKinds) mappings.set(kind, [])
  const sources: Array<{ kind: (typeof governanceRecordKinds)[number]; id: string }> = []
  for (const kind of governanceRecordKinds) {
    const source = governanceSourceTables[kind]
    const columns = source.keys.join(",")
    const rows = await database
      .prepare(`SELECT ${columns} FROM ${source.table} ORDER BY ${columns}`)
      .all<Record<string, string | number>>()
    for (const row of rows.results)
      sources.push({
        kind,
        id: encodeGovernanceRecordId(source.keys.map((key) => String(row[key]))),
      })
  }
  for (const source of sources) {
    const path = `/governance/records/${source.kind}/${encodeURIComponent(source.id)}/preservation-requests`
    const submitted = await request(path, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: {
        procedure_key: definition.key,
        conditions: {
          reason: "Keep governance record",
          preservation: { kind: "hold", retainUntil: null, reason: "Company evidence" },
          disclosure: {
            reason: "Archive verification",
            grants: [
              {
                accountId: creator.accountId,
                actions: ["read", "export"],
                purposes: ["archive"],
                validFrom: now.toISOString(),
                validUntil: null,
              },
            ],
          },
        },
      },
    })
    if (submitted.status !== 201) throw new Error(await submitted.text())
    const record = z
      .object({ number: z.number(), record_id: z.string() })
      .parse(await submitted.json())
    const proposal = await openSystemProposals({ env: { DB: database } }).findByNumber(
      record.number,
    )
    if (proposal === null || proposal instanceof Error) throw new Error("missing proposal")
    const approved = await request(`${path}/${record.number}/approve`, {
      method: "POST",
      accountId: reviewer.accountId,
      body: {
        decision_target: {
          proposal_version: proposal.version,
          proposal_digest: proposal.digest,
          task_key: proposal.currentTaskKey,
          task_round: proposal.currentTaskRound,
        },
        comment: "Reviewed source",
      },
    })
    if (approved.status !== 200) throw new Error(await approved.text())
    const executed = await request(`${path}/${record.number}/execute`, {
      method: "POST",
      body: { proposal_digest: proposal.digest },
    })
    if (executed.status !== 200) throw new Error(await executed.text())
    mappings
      .get(source.kind)
      ?.push({ sourceRecordId: source.id, preservedRecordId: record.record_id })
  }
  const coveragePath = `/governance/record-source-freezes/${freezeId}/coverage-pages`
  const cover = (
    recordKind: string,
    records: Array<{ sourceRecordId: string; preservedRecordId: string }>,
  ) => post(coveragePath, { purpose: "archive", recordKind, records })
  const capabilityMappings = mappings.get("governance-capability-record") ?? []
  const first = await cover("governance-capability-record", capabilityMappings.slice(0, 10))
  if (first.status !== 200) throw new Error(await first.text())
  expect(await first.json()).toMatchObject({
    sequence: 1,
    nextCursor: encodeGovernanceRecordId(["cap-09"]),
    recordCount: 10,
  })
  expect((await cover("governance-capability-record", capabilityMappings.slice(0, 1))).status).toBe(
    409,
  )
  let totalPages = 1
  for (const kind of governanceRecordKinds) {
    const records = mappings.get(kind) ?? []
    for (
      let offset = kind === "governance-capability-record" ? 10 : 0;
      offset < Math.max(records.length, 1);
      offset += 10
    ) {
      const batch = records.slice(offset, offset + 10)
      const page = await cover(kind, batch)
      if (page.status !== 200) throw new Error(await page.text())
      expect(await page.json()).toMatchObject({ recordCount: batch.length })
      totalPages++
    }
  }
  const planResponse = await post(
    `/governance/record-source-freezes/${freezeId}/retirement-plans`,
    {
      purpose: "archive",
    },
  )
  if (planResponse.status !== 200) throw new Error(await planResponse.text())
  const plan = z
    .object({
      id: z.string(),
      digest: z.string(),
      totalPages: z.number(),
      recordKinds: z.array(z.string()),
    })
    .parse(await planResponse.json())
  expect(plan.totalPages).toBe(totalPages)
  expect(plan.recordKinds).toEqual([...governanceRecordKinds])
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "governance-retirement",
    revision: 1,
    title: "Retire preserved governance",
    category: "system",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: JSON.parse(definition.decisionPolicyJson),
    completionOperationKey: "system.record.retire",
    createdByAccountId: creator.accountId,
    createdAt: now,
  })
  if (retirementDefinition instanceof Error) throw retirementDefinition
  expect(await openSystemProcedures(governance.context).publish(retirementDefinition, 0)).toBe(true)
  await execSql(
    database,
    `INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('role:governance-retirement-review','governance:retirement-review','custom','Record reviewer',0,0);
    INSERT INTO system_iam_role_permissions (role_id,permission_key)
    VALUES ('role:governance-retirement-review','system:procedure:read')`,
  )
  await database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
      VALUES ('binding:governance-retirement-review',?1,'role:governance-retirement-review',0)`)
    .bind(reviewer.accountId)
    .run()
  const retirementPath = `/governance/retirement-plans/${plan.id}/requests`
  const retirementBody = {
    plan_digest: plan.digest,
    procedure_key: retirementDefinition.key,
    reason: "Keep company records after removal",
  }
  expect((await post(retirementPath, retirementBody)).status).toBe(503)
  const verificationPath = `/governance/retirement-plans/${plan.id}/verification-receipts`
  for (let ordinal = 1; ordinal <= plan.totalPages; ordinal++) {
    const receipt = await post(verificationPath, {})
    if (receipt.status !== 200) throw new Error(await receipt.text())
    expect(await receipt.json()).toMatchObject({ ordinal, planId: plan.id })
  }
  expect((await post(verificationPath, {})).status).toBe(409)
  const submitted = await post(retirementPath, retirementBody)
  if (submitted.status !== 201) throw new Error(await submitted.text())
  const retirementRequest = z.object({ number: z.number() }).parse(await submitted.json())
  const proposal = await openSystemProposals({
    env: { DB: database },
    visibleCompletionOperationKeys: ["system.record.retire"],
  }).findByNumber(retirementRequest.number)
  if (proposal === null || proposal instanceof Error) throw new Error("missing retirement proposal")
  const reviewerToken = await tokenFor(reviewer.accountId)
  const approved = await app.request(
    `${retirementPath}/${retirementRequest.number}/approve`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${reviewerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        decision_target: {
          proposal_version: proposal.version,
          proposal_digest: proposal.digest,
          task_key: proposal.currentTaskKey,
          task_round: proposal.currentTaskRound,
        },
        comment: "Reviewed all governance records",
      }),
    },
    bindings,
  )
  if (approved.status !== 200) throw new Error(await approved.text())
  const finalized = await post(`${retirementPath}/${retirementRequest.number}/execute`, {
    proposal_version: proposal.version,
    proposal_digest: proposal.digest,
    plan_digest: plan.digest,
  })
  if (finalized.status !== 200) throw new Error(await finalized.text())
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_record_source_retirements")
      .first<number>("n"),
  ).toBe(1)
  expect(
    (
      await post(`/governance/record-source-freezes/${freezeId}/release`, {
        reason: "Cannot restart retired source",
      })
    ).status,
  ).toBe(409)
  await execSql(
    database,
    `INSERT INTO system_iam_role_permissions(role_id,permission_key)
    VALUES ('governance-test-manager','system:record:export');
    DROP TABLE governance_acknowledgements;
    DROP TABLE governance_capabilities;
    DROP TABLE governance_document_references;
    DROP TABLE governance_document_versions;
    DROP TABLE governance_documents;
    DROP TABLE governance_org_role_assignments;
    DROP TABLE governance_org_roles;
    DROP TABLE governance_publication_approvals;`,
  )
  const core = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => new Date())
      context.set("database", drizzle(database))
      await next()
    })
    .get("/system/preserved-records/:recordId/dossier", ...preservedDossier)
  for (const mapping of [...mappings.values()].flat()) {
    const dossier = await core.request(
      `/system/preserved-records/${mapping.preservedRecordId}/dossier?purpose=archive`,
      { headers: { authorization: `Bearer ${token}` } },
      bindings,
    )
    if (dossier.status !== 200) throw new Error(await dossier.text())
    expect(await dossier.json()).toMatchObject({
      version: 1,
      execution: { caseId: expect.any(String) },
      auditReceipts: expect.any(Array),
    })
  }
}, 60_000)
