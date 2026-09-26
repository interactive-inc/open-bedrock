import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createPerformanceReviewPreservationFixture } from "@/contexts/performance-review/test/create-performance-review-preservation-fixture.test-support"
import { performanceReviewRecordKinds } from "@/contexts/performance-review/domain/definitions/performance-review-record-kind.definition"
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

/** 並び順が連番と一致する評価テンプレートの UUID。 */
function templateId(serial: number): string {
  return `01900034-0000-7000-8000-${serial.toString(16).padStart(12, "0")}`
}

test("人事評価8台帳を分割照合し撤去確定する", async () => {
  const { database, governance, creator, reviewer, definition, bindings, tokenFor, request } =
    await createPerformanceReviewPreservationFixture(await pool.next())
  for (let serial = 1; serial <= 11; serial++) {
    const id = templateId(serial)
    await database
      .prepare(`INSERT INTO evaluation_templates
      (id,title,period,items,status,created_by,created_at,updated_at)
      VALUES (?1,?2,'2026-Q3','[]','draft',?3,'2026-09-01','2026-09-01')`)
      .bind(id, `Evaluation ${serial}`, creator.employeeId)
      .run()
  }
  const token = await tokenFor(creator.accountId)
  const stepUpToken = "f".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const now = new Date()
  await database
    .prepare(`INSERT INTO system_step_up_grants
      (id,account_id,token_hash,method,issued_at,expires_at)
      VALUES ('9b6eac10-c498-491c-b75f-6d6a82e04665',?1,?2,'external_identity',?3,?4)`)
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
    "/performance-review/record-source-freezes",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": freezeId,
        "x-system-step-up": stepUpToken,
      },
      body: JSON.stringify({ reason: "Verify performance review archive" }),
    },
    bindings,
  )
  if (frozen.status !== 201) throw new Error(await frozen.text())
  const templateMappings: Array<{ sourceRecordId: string; preservedRecordId: string }> = []
  const sources = Array.from({ length: 11 }, (_, index) => ({
    kind: "evaluation-template-record" as const,
    id: templateId(index + 1),
  }))
  for (const source of sources) {
    const path = `/performance-review/records/${source.kind}/${encodeURIComponent(source.id)}/preservation-requests`
    const submitted = await request(path, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: {
        procedure_key: definition.key,
        conditions: {
          reason: "Keep performance review record",
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
    templateMappings.push({ sourceRecordId: source.id, preservedRecordId: record.record_id })
  }
  const coveragePath = `/performance-review/record-source-freezes/${freezeId}/coverage-pages`
  const cover = (recordKind: string, records: typeof templateMappings) =>
    post(coveragePath, { purpose: "archive", recordKind, records })
  const first = await cover("evaluation-template-record", templateMappings.slice(0, 10))
  if (first.status !== 200) throw new Error(await first.text())
  expect(await first.json()).toMatchObject({
    sequence: 1,
    nextCursor: templateId(10),
    recordCount: 10,
  })
  expect((await cover("evaluation-template-record", templateMappings.slice(0, 1))).status).toBe(409)
  const second = await cover("evaluation-template-record", templateMappings.slice(10))
  if (second.status !== 200) throw new Error(await second.text())
  expect(await second.json()).toMatchObject({ sequence: 2, nextCursor: null, recordCount: 1 })
  for (const kind of performanceReviewRecordKinds.filter(
    (kind) => kind !== "evaluation-template-record",
  )) {
    const page = await cover(kind, [])
    if (page.status !== 200) throw new Error(await page.text())
    expect(await page.json()).toMatchObject({ sequence: 1, nextCursor: null, recordCount: 0 })
  }
  const planResponse = await post(
    `/performance-review/record-source-freezes/${freezeId}/retirement-plans`,
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
  expect(plan.totalPages).toBe(9)
  expect(plan.recordKinds).toEqual([...performanceReviewRecordKinds])
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "performance-review-retirement",
    revision: 1,
    title: "Retire preserved performance review",
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
    VALUES ('ed7a7e8f-1859-47e2-85ef-0f185ddcd27f','performance-review:retirement-review','custom','Record reviewer',0,0);
    INSERT INTO system_iam_role_permissions (role_id,permission_key)
    VALUES ('ed7a7e8f-1859-47e2-85ef-0f185ddcd27f','system:procedure:read')`,
  )
  await database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
      VALUES ('8e4e43bb-c96f-4b30-8a67-f82dbf4a6b0d',?1,'ed7a7e8f-1859-47e2-85ef-0f185ddcd27f',0)`)
    .bind(reviewer.accountId)
    .run()
  const retirementPath = `/performance-review/retirement-plans/${plan.id}/requests`
  const retirementBody = {
    plan_digest: plan.digest,
    procedure_key: retirementDefinition.key,
    reason: "Keep company records after removal",
  }
  expect((await post(retirementPath, retirementBody)).status).toBe(503)
  const verificationPath = `/performance-review/retirement-plans/${plan.id}/verification-receipts`
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
        comment: "Reviewed all performance review records",
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
      await post(`/performance-review/record-source-freezes/${freezeId}/release`, {
        reason: "Cannot restart retired source",
      })
    ).status,
  ).toBe(409)
  await execSql(
    database,
    `INSERT INTO system_iam_role_permissions(role_id,permission_key)
    VALUES ('f2b5cb7d-a83a-4823-80ed-24b9da2c2996','system:record:export');
    DROP TABLE evaluation_sheet_audit_logs;
    DROP TABLE evaluation_sheets;
    DROP TABLE evaluation_templates;
    DROP TABLE goal_evaluations;
    DROP TABLE performance_goals;
    DROP TABLE review_cycle_policies;
    DROP TABLE review_cycles;
    DROP TABLE review_forms;`,
  )
  const core = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => new Date())
      context.set("database", drizzle(database))
      await next()
    })
    .get("/system/preserved-records/:recordId/dossier", ...preservedDossier)
  for (const mapping of templateMappings) {
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
}, 30_000)
