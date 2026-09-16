import { expect, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createPartnerPreservationFixture } from "@/contexts/partner/test/create-partner-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { GET as preservedDossier } from "@system/interface/routes/system.preserved-records.$recordId.dossier"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { drizzle } from "drizzle-orm/d1"

test("負数・0を含む取引先11件と契約記録を分割照合し撤去確定する", async () => {
  const { database, governance, creator, reviewer, definition, bindings, tokenFor, request } =
    await createPartnerPreservationFixture()
  for (let id = -9; id <= 1; id++) {
    await database
      .prepare(`INSERT INTO partners
      (id,code,name,category,corporate_number,note,status,created_at)
      VALUES (?1,?2,?3,'supplier',NULL,NULL,'active','2026-09-01T00:00:00.000Z')`)
      .bind(id, `vendor-${id}`, `Vendor ${id}`)
      .run()
  }
  await database.exec(`INSERT INTO partner_contracts
    (id,partner_id,title,contract_date,starts_on,ends_on,renewal_deadline,note,created_at)
    VALUES (1,-9,'Service Agreement','2026-09-15','2026-10-01','2027-09-30',
      '2027-08-31','Annual renewal','2026-09-15T12:00:00.000Z')`)
  const token = await tokenFor(creator.accountId)
  const stepUpToken = "f".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const now = new Date()
  await database
    .prepare(`INSERT INTO system_step_up_grants
      (id,account_id,token_hash,method,issued_at,expires_at)
      VALUES ('partner-coverage-step-up',?1,?2,'external_identity',?3,?4)`)
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
    "/partner/record-source-freezes",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": freezeId,
        "x-system-step-up": stepUpToken,
      },
      body: JSON.stringify({ reason: "Verify partner archive" }),
    },
    bindings,
  )
  if (frozen.status !== 201) throw new Error(await frozen.text())
  const partnerMappings: Array<{ sourceRecordId: string; preservedRecordId: string }> = []
  const contractMappings: Array<{ sourceRecordId: string; preservedRecordId: string }> = []
  const sources = [
    ...Array.from({ length: 11 }, (_, index) => ({
      kind: "partner-record" as const,
      id: String(index - 9),
    })),
    { kind: "partner-contract-record" as const, id: "1" },
  ]
  for (const source of sources) {
    const path = `/partner/records/${source.kind}/${encodeURIComponent(source.id)}/preservation-requests`
    const submitted = await request(path, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: {
        procedure_key: definition.key,
        conditions: {
          reason: "Keep partner record",
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
    const proposal = await new SystemD1ProposalAdapter({ env: { DB: database } }).findByNumber(
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
    const mappings = source.kind === "partner-record" ? partnerMappings : contractMappings
    mappings.push({ sourceRecordId: source.id, preservedRecordId: record.record_id })
  }
  const coveragePath = `/partner/record-source-freezes/${freezeId}/coverage-pages`
  const cover = (recordKind: string, records: typeof partnerMappings) =>
    post(coveragePath, { purpose: "archive", recordKind, records })
  const first = await cover("partner-record", partnerMappings.slice(0, 10))
  if (first.status !== 200) throw new Error(await first.text())
  expect(await first.json()).toMatchObject({ sequence: 1, nextCursor: "0", recordCount: 10 })
  expect((await cover("partner-record", partnerMappings.slice(0, 1))).status).toBe(409)
  const second = await cover("partner-record", partnerMappings.slice(10))
  if (second.status !== 200) throw new Error(await second.text())
  expect(await second.json()).toMatchObject({ sequence: 2, nextCursor: null, recordCount: 1 })
  const contract = await cover("partner-contract-record", contractMappings)
  if (contract.status !== 200) throw new Error(await contract.text())
  expect(await contract.json()).toMatchObject({ sequence: 1, nextCursor: null, recordCount: 1 })
  const planResponse = await post(`/partner/record-source-freezes/${freezeId}/retirement-plans`, {
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
  expect(plan.totalPages).toBe(3)
  expect(plan.recordKinds).toEqual(["partner-record", "partner-contract-record"])
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "partner-retirement",
    revision: 1,
    title: "Retire preserved partner",
    category: "system",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: JSON.parse(definition.decisionPolicyJson),
    completionOperationKey: "system.record.retire",
    createdByAccountId: creator.accountId,
    createdAt: now,
  })
  if (retirementDefinition instanceof Error) throw retirementDefinition
  expect(
    await new SystemD1ProcedureRepository(governance.context).publish(retirementDefinition, 0),
  ).toBe(true)
  await database.exec(`INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('role:partner-retirement-review','partner:retirement-review','custom','Record reviewer',0,0);
    INSERT INTO system_iam_role_permissions (role_id,permission_key)
    VALUES ('role:partner-retirement-review','system:procedure:read')`)
  await database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
      VALUES ('binding:partner-retirement-review',?1,'role:partner-retirement-review',0)`)
    .bind(reviewer.accountId)
    .run()
  const retirementPath = `/partner/retirement-plans/${plan.id}/requests`
  const retirementBody = {
    plan_digest: plan.digest,
    procedure_key: retirementDefinition.key,
    reason: "Keep company records after removal",
  }
  expect((await post(retirementPath, retirementBody)).status).toBe(503)
  const verificationPath = `/partner/retirement-plans/${plan.id}/verification-receipts`
  for (let ordinal = 1; ordinal <= plan.totalPages; ordinal++) {
    const receipt = await post(verificationPath, {})
    if (receipt.status !== 200) throw new Error(await receipt.text())
    expect(await receipt.json()).toMatchObject({ ordinal, planId: plan.id })
  }
  expect((await post(verificationPath, {})).status).toBe(409)
  const submitted = await post(retirementPath, retirementBody)
  if (submitted.status !== 201) throw new Error(await submitted.text())
  const retirementRequest = z.object({ number: z.number() }).parse(await submitted.json())
  const proposal = await new SystemD1ProposalAdapter({
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
        comment: "Reviewed all partner records",
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
      await post(`/partner/record-source-freezes/${freezeId}/release`, {
        reason: "Cannot restart retired source",
      })
    ).status,
  ).toBe(409)
  await database.exec(`INSERT INTO system_iam_role_permissions(role_id,permission_key)
    VALUES ('partner-test-manager','system:record:export');
    DROP TABLE partner_contracts;
    DROP TABLE partners;`)
  const core = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => new Date())
      context.set("database", drizzle(database))
      await next()
    })
    .get("/system/preserved-records/:recordId/dossier", ...preservedDossier)
  for (const mapping of [...partnerMappings, ...contractMappings]) {
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
