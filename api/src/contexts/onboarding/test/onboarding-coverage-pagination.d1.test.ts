import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createOnboardingPreservationFixture } from "@/contexts/onboarding/test/create-onboarding-preservation-fixture.test-support"
import {
  encodeOnboardingTemplateTaskRecordId,
  onboardingRecordKinds,
} from "@/contexts/onboarding/domain/definitions/onboarding-record-kind.definition"
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

/** 旧来の整数の並び（-9..1）と同じ辞書順になる固定の UUID。 */
function templateId(serial: number): string {
  return `0190003c-0000-7000-8000-${serial.toString(16).padStart(12, "0")}`
}

test("入退社手続き6台帳を分割照合し撤去確定する", async () => {
  const { database, governance, creator, reviewer, definition, bindings, tokenFor, request } =
    await createOnboardingPreservationFixture(await pool.next())
  for (let id = -9; id <= 1; id++) {
    await database
      .prepare(`INSERT INTO onboarding_templates
      (id,code,name,kind,description) VALUES (?1,?2,?3,'hire','Checklist')`)
      .bind(templateId(id + 10), `template-${id}`, `Template ${id}`)
      .run()
  }
  await execSql(
    database,
    `INSERT INTO onboarding_template_tasks
    (id,template_code,code,title,sort_order,owner_role)
    VALUES ('01900038-0000-7000-8000-000000000001','template--9','task:a','Prepare',1,NULL)`,
  )
  await database
    .prepare(`INSERT INTO onboarding_assignments
    (id,employee_id,template_code,kind,status,assigned_at)
    VALUES ('0190003d-0000-7000-8000-000000000001',?1,'template--9','hire','pending','2026-09-15T00:00:00.000Z')`)
    .bind(creator.employeeId)
    .run()
  await execSql(
    database,
    `INSERT INTO onboarding_tasks
    (id,assignment_id,template_task_code,title,sort_order,status,completed_at)
    VALUES ('0190003e-0000-7000-8000-000000000001','0190003d-0000-7000-8000-000000000001','task:a','Prepare',1,'pending',NULL)`,
  )
  const actionId = await database
    .prepare("SELECT id FROM company_personnel_actions LIMIT 1")
    .first<string>("id")
  if (!actionId) throw new Error("missing Company lifecycle action")
  await database
    .prepare(`INSERT INTO system_jobs
    (id,operation_key,payload_digest,idempotency_key,created_by_account_id,status,attempt,max_attempts,
      available_at,created_at,updated_at)
    VALUES ('01900041-0000-4000-8000-000000000001','onboarding.lifecycle','${"a".repeat(64)}','onboarding-test',?1,'queued',0,3,1,1,1)`)
    .bind(creator.accountId)
    .run()
  await database
    .prepare(`INSERT INTO onboarding_lifecycle_deliveries
    (job_id,action_id,created_at,outcome,assignment_id,processed_at)
    VALUES ('01900041-0000-4000-8000-000000000001',?1,1,'assigned','0190003d-0000-7000-8000-000000000001',2)`)
    .bind(actionId)
    .run()
  await database
    .prepare(`INSERT INTO onboarding_lifecycle_template_bindings
    (id,effect_type,template_code,updated_at,updated_by_account_id)
    VALUES ('01900040-0000-7000-8000-000000000001','hire','template--9',3,?1)`)
    .bind(creator.accountId)
    .run()
  const token = await tokenFor(creator.accountId)
  const stepUpToken = "f".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const now = new Date()
  await database
    .prepare(`INSERT INTO system_step_up_grants
      (id,account_id,token_hash,method,issued_at,expires_at)
      VALUES ('onboarding-coverage-step-up',?1,?2,'external_identity',?3,?4)`)
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
    "/onboarding/record-source-freezes",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": freezeId,
        "x-system-step-up": stepUpToken,
      },
      body: JSON.stringify({ reason: "Verify onboarding archive" }),
    },
    bindings,
  )
  if (frozen.status !== 201) throw new Error(await frozen.text())
  const templateMappings: Array<{ sourceRecordId: string; preservedRecordId: string }> = []
  const taskMappings: Array<{ sourceRecordId: string; preservedRecordId: string }> = []
  const assignmentMappings: typeof taskMappings = []
  const completionMappings: typeof taskMappings = []
  const deliveryMappings: typeof taskMappings = []
  const bindingMappings: typeof taskMappings = []
  const sources = [
    ...Array.from({ length: 11 }, (_, index) => ({
      kind: "onboarding-template-record" as const,
      id: templateId(index + 1),
    })),
    {
      kind: "onboarding-template-task-record" as const,
      id: encodeOnboardingTemplateTaskRecordId("template--9", "task:a"),
    },
    { kind: "onboarding-assignment-record" as const, id: "0190003d-0000-7000-8000-000000000001" },
    { kind: "onboarding-task-record" as const, id: "0190003e-0000-7000-8000-000000000001" },
    {
      kind: "onboarding-lifecycle-delivery-record" as const,
      id: "01900041-0000-4000-8000-000000000001",
    },
    { kind: "onboarding-lifecycle-template-binding-record" as const, id: "hire" },
  ]
  for (const source of sources) {
    const path = `/onboarding/records/${source.kind}/${encodeURIComponent(source.id)}/preservation-requests`
    const submitted = await request(path, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: {
        procedure_key: definition.key,
        conditions: {
          reason: "Keep onboarding record",
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
    const mappings = {
      "onboarding-template-record": templateMappings,
      "onboarding-template-task-record": taskMappings,
      "onboarding-assignment-record": assignmentMappings,
      "onboarding-task-record": completionMappings,
      "onboarding-lifecycle-delivery-record": deliveryMappings,
      "onboarding-lifecycle-template-binding-record": bindingMappings,
    }[source.kind]
    mappings.push({ sourceRecordId: source.id, preservedRecordId: record.record_id })
  }
  const coveragePath = `/onboarding/record-source-freezes/${freezeId}/coverage-pages`
  const cover = (recordKind: string, records: typeof templateMappings) =>
    post(coveragePath, { purpose: "archive", recordKind, records })
  const first = await cover("onboarding-template-record", templateMappings.slice(0, 10))
  if (first.status !== 200) throw new Error(await first.text())
  expect(await first.json()).toMatchObject({
    sequence: 1,
    nextCursor: templateId(10),
    recordCount: 10,
  })
  expect((await cover("onboarding-template-record", templateMappings.slice(0, 1))).status).toBe(409)
  const second = await cover("onboarding-template-record", templateMappings.slice(10))
  if (second.status !== 200) throw new Error(await second.text())
  expect(await second.json()).toMatchObject({ sequence: 2, nextCursor: null, recordCount: 1 })
  const task = await cover("onboarding-template-task-record", taskMappings)
  if (task.status !== 200) throw new Error(await task.text())
  expect(await task.json()).toMatchObject({ sequence: 1, nextCursor: null, recordCount: 1 })
  for (const [kind, records] of [
    ["onboarding-assignment-record", assignmentMappings],
    ["onboarding-task-record", completionMappings],
    ["onboarding-lifecycle-delivery-record", deliveryMappings],
    ["onboarding-lifecycle-template-binding-record", bindingMappings],
  ] as const) {
    const page = await cover(kind, records)
    if (page.status !== 200) throw new Error(await page.text())
    expect(await page.json()).toMatchObject({ sequence: 1, nextCursor: null, recordCount: 1 })
  }
  const planResponse = await post(
    `/onboarding/record-source-freezes/${freezeId}/retirement-plans`,
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
  expect(plan.totalPages).toBe(7)
  expect(plan.recordKinds).toEqual([...onboardingRecordKinds])
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "onboarding-retirement",
    revision: 1,
    title: "Retire preserved onboarding",
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
    VALUES ('052f0f2b-56cf-4e9b-812e-4029d7e6dded','onboarding:retirement-review','custom','Record reviewer',0,0);
    INSERT INTO system_iam_role_permissions (role_id,permission_key)
    VALUES ('052f0f2b-56cf-4e9b-812e-4029d7e6dded','system:procedure:read')`,
  )
  await database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
      VALUES ('e77cd8b5-55bc-4e03-8a43-e2f5622644e4',?1,'052f0f2b-56cf-4e9b-812e-4029d7e6dded',0)`)
    .bind(reviewer.accountId)
    .run()
  const retirementPath = `/onboarding/retirement-plans/${plan.id}/requests`
  const retirementBody = {
    plan_digest: plan.digest,
    procedure_key: retirementDefinition.key,
    reason: "Keep company records after removal",
  }
  expect((await post(retirementPath, retirementBody)).status).toBe(503)
  const verificationPath = `/onboarding/retirement-plans/${plan.id}/verification-receipts`
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
        comment: "Reviewed all onboarding records",
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
      await post(`/onboarding/record-source-freezes/${freezeId}/release`, {
        reason: "Cannot restart retired source",
      })
    ).status,
  ).toBe(409)
  // D1は外部キーを常に検査するため、参照する側の台帳から撤去する。
  await execSql(
    database,
    `INSERT INTO system_iam_role_permissions(role_id,permission_key)
    VALUES ('424962a0-2f17-4779-8f89-688b21730d9f','system:record:export');
    DROP TABLE onboarding_lifecycle_deliveries;
    DROP TABLE onboarding_tasks;
    DROP TABLE onboarding_template_tasks;
    DROP TABLE onboarding_assignments;
    DROP TABLE onboarding_templates;`,
  )
  const core = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => new Date())
      context.set("database", drizzle(database))
      await next()
    })
    .get("/system/preserved-records/:recordId/dossier", ...preservedDossier)
  for (const mapping of [
    ...templateMappings,
    ...taskMappings,
    ...assignmentMappings,
    ...completionMappings,
    ...deliveryMappings,
  ]) {
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
