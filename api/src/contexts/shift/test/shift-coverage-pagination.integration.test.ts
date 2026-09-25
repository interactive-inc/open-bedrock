import { expect, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createShiftPreservationFixture } from "@/contexts/shift/test/create-shift-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { GET as preservedDossier } from "@system/interface/routes/system.preserved-records.$recordId.dossier"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { drizzle } from "drizzle-orm/d1"

/** 連番の記録 ID。UUID の辞書順が連番の順と一致する。 */
function recordId(prefix: string, serial: number): string {
  return `${prefix}-0000-7000-8000-${serial.toString(16).padStart(12, "0")}`
}

const patternId = (serial: number) => recordId("01900023", serial)
const assignmentId = recordId("01900024", 1)
const swapRequestId = recordId("01900025", 1)

test("勤務パターン11件と割当・交代申請を分割照合し撤去確定する", async () => {
  const { database, governance, creator, reviewer, definition, bindings, tokenFor, request } =
    await createShiftPreservationFixture()
  for (let serial = 1; serial <= 11; serial++) {
    await database
      .prepare(`INSERT INTO shift_patterns
      (id,code,name,start_time,end_time,break_minutes)
      VALUES (?1,?2,?3,'09:00','18:00',60)`)
      .bind(patternId(serial), `day-${serial}`, `Day ${serial}`)
      .run()
  }
  await database
    .prepare(`INSERT INTO shift_assignments
    (id,employee_id,pattern_id,date,note,published_at)
    VALUES (?2,?1,?3,'2026-09-15','Front desk','2026-09-01T12:00:00.000Z')`)
    .bind(creator.employeeId, assignmentId, patternId(1))
    .run()
  await database
    .prepare(`INSERT INTO shift_swap_requests
    (id,requester_employee_id,target_employee_id,date,note,status,approved_at)
    VALUES (?3,?1,?2,'2026-09-15','Trade','approved','2026-09-10T12:00:00.000Z')`)
    .bind(creator.employeeId, reviewer.employeeId, swapRequestId)
    .run()
  const token = await tokenFor(creator.accountId)
  const stepUpToken = "f".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const now = new Date()
  await database
    .prepare(`INSERT INTO system_step_up_grants
      (id,account_id,token_hash,method,issued_at,expires_at)
      VALUES ('shift-coverage-step-up',?1,?2,'external_identity',?3,?4)`)
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
    "/shift/record-source-freezes",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": freezeId,
        "x-system-step-up": stepUpToken,
      },
      body: JSON.stringify({ reason: "Verify shift archive" }),
    },
    bindings,
  )
  if (frozen.status !== 201) throw new Error(await frozen.text())
  const shiftMappings: Array<{ sourceRecordId: string; preservedRecordId: string }> = []
  const assignmentMappings: Array<{ sourceRecordId: string; preservedRecordId: string }> = []
  const swapMappings: Array<{ sourceRecordId: string; preservedRecordId: string }> = []
  const sources = [
    ...Array.from({ length: 11 }, (_, index) => ({
      kind: "shift-pattern-record" as const,
      id: patternId(index + 1),
    })),
    { kind: "shift-assignment-record" as const, id: assignmentId },
    { kind: "shift-swap-request-record" as const, id: swapRequestId },
  ]
  for (const source of sources) {
    const path = `/shift/records/${source.kind}/${encodeURIComponent(source.id)}/preservation-requests`
    const submitted = await request(path, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: {
        procedure_key: definition.key,
        conditions: {
          reason: "Keep shift record",
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
    const mappings =
      source.kind === "shift-pattern-record"
        ? shiftMappings
        : source.kind === "shift-assignment-record"
          ? assignmentMappings
          : swapMappings
    mappings.push({ sourceRecordId: source.id, preservedRecordId: record.record_id })
  }
  const coveragePath = `/shift/record-source-freezes/${freezeId}/coverage-pages`
  const cover = (recordKind: string, records: typeof shiftMappings) =>
    post(coveragePath, { purpose: "archive", recordKind, records })
  const first = await cover("shift-pattern-record", shiftMappings.slice(0, 10))
  if (first.status !== 200) throw new Error(await first.text())
  expect(await first.json()).toMatchObject({
    sequence: 1,
    nextCursor: patternId(10),
    recordCount: 10,
  })
  expect((await cover("shift-pattern-record", shiftMappings.slice(0, 1))).status).toBe(409)
  const second = await cover("shift-pattern-record", shiftMappings.slice(10))
  if (second.status !== 200) throw new Error(await second.text())
  expect(await second.json()).toMatchObject({ sequence: 2, nextCursor: null, recordCount: 1 })
  const minutes = await cover("shift-assignment-record", assignmentMappings)
  if (minutes.status !== 200) throw new Error(await minutes.text())
  expect(await minutes.json()).toMatchObject({ sequence: 1, nextCursor: null, recordCount: 1 })
  const decision = await cover("shift-swap-request-record", swapMappings)
  if (decision.status !== 200) throw new Error(await decision.text())
  expect(await decision.json()).toMatchObject({ sequence: 1, nextCursor: null, recordCount: 1 })
  const planResponse = await post(`/shift/record-source-freezes/${freezeId}/retirement-plans`, {
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
  expect(plan.totalPages).toBe(4)
  expect(plan.recordKinds).toEqual([
    "shift-pattern-record",
    "shift-assignment-record",
    "shift-swap-request-record",
  ])
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "shift-retirement",
    revision: 1,
    title: "Retire preserved shift",
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
  await database.exec(`INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('role:shift-retirement-review','shift:retirement-review','custom','Record reviewer',0,0);
    INSERT INTO system_iam_role_permissions (role_id,permission_key)
    VALUES ('role:shift-retirement-review','system:procedure:read')`)
  await database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
      VALUES ('binding:shift-retirement-review',?1,'role:shift-retirement-review',0)`)
    .bind(reviewer.accountId)
    .run()
  const retirementPath = `/shift/retirement-plans/${plan.id}/requests`
  const retirementBody = {
    plan_digest: plan.digest,
    procedure_key: retirementDefinition.key,
    reason: "Keep company records after removal",
  }
  expect((await post(retirementPath, retirementBody)).status).toBe(503)
  const verificationPath = `/shift/retirement-plans/${plan.id}/verification-receipts`
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
        comment: "Reviewed all shift records",
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
      await post(`/shift/record-source-freezes/${freezeId}/release`, {
        reason: "Cannot restart retired source",
      })
    ).status,
  ).toBe(409)
  await database.exec(`INSERT INTO system_iam_role_permissions(role_id,permission_key)
    VALUES ('shift-test-manager','system:record:export');
    DROP TABLE shift_assignments;
    DROP TABLE shift_swap_requests;
    DROP TABLE shift_patterns;`)
  const core = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => new Date())
      context.set("database", drizzle(database))
      await next()
    })
    .get("/system/preserved-records/:recordId/dossier", ...preservedDossier)
  for (const mapping of [...shiftMappings, ...assignmentMappings, ...swapMappings]) {
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
