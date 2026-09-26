import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createLeavePreservationFixture } from "@/contexts/leave/test/create-leave-preservation-fixture.test-support"
import { encodeLeaveBalanceRecordId } from "@/contexts/leave/domain/definitions/leave-record-kind.definition"
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

const requestId = (serial: number) =>
  `01900049-0000-7000-8000-${serial.toString(16).padStart(12, "0")}`

test("休暇申請11件と残数を停止世代ごとに分割照合し、空の台帳も完了させる", async () => {
  const { database, governance, creator, reviewer, definition, bindings, tokenFor, request } =
    await createLeavePreservationFixture(await pool.next())
  for (let id = 1; id <= 11; id++) {
    await database
      .prepare(`INSERT INTO leave_requests
        (id,employee_id,leave_type,start_date,end_date,days,reason,status,created_at,unit,consumed_days)
        VALUES (?1,?2,'annual','2026-10-01','2026-10-01',1,?3,'pending',
          '2026-09-01T00:00:00.000Z','full_day',1)`)
      .bind(requestId(id), creator.employeeId, `Request ${id}`)
      .run()
  }
  await database
    .prepare(`INSERT INTO leave_balances
      (id,employee_id,fiscal_year,leave_type,granted_days,used_days,remaining_days)
      VALUES ('0190004c-0000-7000-8000-000000000001',?1,'2026','annual',20,0,20)`)
    .bind(creator.employeeId)
    .run()
  const token = await tokenFor(creator.accountId)
  const stepUpToken = "f".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const now = new Date()
  await database
    .prepare(`INSERT INTO system_step_up_grants
      (id,account_id,token_hash,method,issued_at,expires_at)
      VALUES ('0ed90391-e95d-4b6c-98ef-d78be36b670b',?1,?2,'external_identity',?3,?4)`)
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
    "/leave/record-source-freezes",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": freezeId,
        "x-system-step-up": stepUpToken,
      },
      body: JSON.stringify({ reason: "Verify leave archive" }),
    },
    bindings,
  )
  if (frozen.status !== 201) throw new Error(await frozen.text())
  const requestMappings: Array<{ sourceRecordId: string; preservedRecordId: string }> = []
  const balanceMappings: Array<{ sourceRecordId: string; preservedRecordId: string }> = []
  const balanceId = encodeLeaveBalanceRecordId(creator.employeeId, "2026", "annual")
  const sources = [
    ...Array.from({ length: 11 }, (_, index) => ({
      kind: "leave-request-record" as const,
      id: requestId(index + 1),
    })),
    { kind: "leave-balance-record" as const, id: balanceId },
  ]
  for (const source of sources) {
    const path = `/leave/records/${source.kind}/${encodeURIComponent(source.id)}/preservation-requests`
    const submitted = await request(path, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: {
        procedure_key: definition.key,
        conditions: {
          reason: "Keep leave record",
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
    ;(source.kind === "leave-request-record" ? requestMappings : balanceMappings).push({
      sourceRecordId: source.id,
      preservedRecordId: record.record_id,
    })
  }
  const coveragePath = `/leave/record-source-freezes/${freezeId}/coverage-pages`
  const cover = (recordKind: string, records: typeof requestMappings) =>
    post(coveragePath, { purpose: "archive", recordKind, records })
  const first = await cover("leave-request-record", requestMappings.slice(0, 10))
  if (first.status !== 200) throw new Error(await first.text())
  expect(await first.json()).toMatchObject({
    sequence: 1,
    nextCursor: requestId(10),
    recordCount: 10,
  })
  expect((await cover("leave-request-record", requestMappings.slice(0, 1))).status).toBe(409)
  expect(
    (await cover("leave-request-record", [requestMappings[10]!, requestMappings[10]!])).status,
  ).toBe(409)
  const second = await cover("leave-request-record", requestMappings.slice(10))
  if (second.status !== 200) throw new Error(await second.text())
  expect(await second.json()).toMatchObject({ sequence: 2, nextCursor: null, recordCount: 1 })
  const balance = await cover("leave-balance-record", balanceMappings)
  if (balance.status !== 200) throw new Error(await balance.text())
  expect(await balance.json()).toMatchObject({ sequence: 1, nextCursor: null, recordCount: 1 })
  for (const recordKind of [
    "leave-procedure-binding-record",
    "leave-decision-notification-record",
  ]) {
    const empty = await cover(recordKind, [])
    if (empty.status !== 200) throw new Error(await empty.text())
    expect(await empty.json()).toMatchObject({ sequence: 1, nextCursor: null, recordCount: 0 })
  }
  const planResponse = await post(`/leave/record-source-freezes/${freezeId}/retirement-plans`, {
    purpose: "archive",
  })
  if (planResponse.status !== 200) throw new Error(await planResponse.text())
  const plan = z
    .object({
      id: z.string(),
      digest: z.string(),
      totalPages: z.number(),
      recordKinds: z.array(z.string()),
    })
    .parse(await planResponse.json())
  expect(plan.totalPages).toBe(5)
  expect(plan.recordKinds).toEqual([
    "leave-request-record",
    "leave-balance-record",
    "leave-procedure-binding-record",
    "leave-decision-notification-record",
  ])
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "leave-retirement",
    revision: 1,
    title: "Retire preserved leave",
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
    VALUES ('c9d33201-4569-463d-8468-2077108e8635','leave:retirement-review','custom','Record reviewer',0,0);
    INSERT INTO system_iam_role_permissions (role_id,permission_key)
    VALUES ('c9d33201-4569-463d-8468-2077108e8635','system:procedure:read')`,
  )
  await database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
      VALUES ('07e47585-6e29-4fce-8645-34e5d4ff0f28',?1,'c9d33201-4569-463d-8468-2077108e8635',0)`)
    .bind(reviewer.accountId)
    .run()
  const retirementPath = `/leave/retirement-plans/${plan.id}/requests`
  const retirementBody = {
    plan_digest: plan.digest,
    procedure_key: retirementDefinition.key,
    reason: "Keep company records after removal",
  }
  expect((await post(retirementPath, retirementBody)).status).toBe(503)
  const verificationPath = `/leave/retirement-plans/${plan.id}/verification-receipts`
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
        comment: "Reviewed all leave records",
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
      await post(`/leave/record-source-freezes/${freezeId}/release`, {
        reason: "Cannot restart retired source",
      })
    ).status,
  ).toBe(409)
  await execSql(
    database,
    `INSERT INTO system_iam_role_permissions(role_id,permission_key)
    VALUES ('e8f97a27-aed2-4276-8b2e-8a173fe503c4','system:record:export');
    DROP TABLE leave_decision_notifications;
    DROP TABLE leave_procedure_bindings;
    DROP TABLE leave_balances;
    DROP TABLE leave_requests;`,
  )
  const core = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => new Date())
      context.set("database", drizzle(database))
      await next()
    })
    .get("/system/preserved-records/:recordId/dossier", ...preservedDossier)
  for (const mapping of [...requestMappings, ...balanceMappings]) {
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
