import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createPartnerPreservationFixture } from "@/contexts/partner/test/create-partner-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
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

test("取引先2台帳を停止中に人の承認で保全し、業務コードを外してもSystemから読める", async () => {
  const { database, creator, reviewer, definition, bindings, tokenFor, request } =
    await createPartnerPreservationFixture(await pool.next())
  await execSql(
    database,
    `INSERT INTO partners
    (id,code,name,category,corporate_number,note,status,created_at)
    VALUES ('0190001d-0000-7000-8000-000000000001','vendor-1','Vendor One','supplier','1234567890123','Preferred','active',
      '2026-09-01T00:00:00.000Z')`,
  )
  await execSql(
    database,
    `INSERT INTO partner_contracts
    (id,partner_id,title,contract_date,starts_on,ends_on,renewal_deadline,note,created_at)
    VALUES ('0190001e-0000-7000-8000-000000000002','0190001d-0000-7000-8000-000000000001','Service Agreement','2026-09-15','2026-10-01','2027-09-30',
      '2027-08-31','Annual renewal','2026-09-15T12:00:00.000Z')`,
  )
  const token = await tokenFor(creator.accountId)
  const stepUpToken = "e".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const now = new Date()
  await database
    .prepare(`INSERT INTO system_step_up_grants
      (id,account_id,token_hash,method,issued_at,expires_at)
      VALUES ('partner-test-step-up',?1,?2,'external_identity',?3,?4)`)
    .bind(creator.accountId, hash, now.getTime(), now.getTime() + 60_000)
    .run()
  const frozen = await app.request(
    "/partner/record-source-freezes",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
        "x-system-step-up": stepUpToken,
      },
      body: JSON.stringify({ reason: "Retain partner evidence" }),
    },
    bindings,
  )
  if (frozen.status !== 201) throw new Error(await frozen.text())
  for (const [table, column] of [
    ["partners", "name"],
    ["partner_contracts", "title"],
  ]) {
    await expect(database.prepare(`UPDATE ${table} SET ${column}='changed'`).run()).rejects.toThrow(
      "partner_record_source_frozen",
    )
  }
  const sources = [
    ["partner-record", "0190001d-0000-7000-8000-000000000001"],
    ["partner-contract-record", "0190001e-0000-7000-8000-000000000002"],
  ] as const
  const preservedIds: string[] = []
  for (const [recordKind, recordId] of sources) {
    const path = `/partner/records/${recordKind}/${recordId}/preservation-requests`
    const submitted = await request(path, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: {
        procedure_key: definition.key,
        conditions: {
          reason: "Retain original partner record",
          preservation: { kind: "hold", retainUntil: null, reason: "Company evidence" },
          disclosure: {
            reason: "Restricted archive",
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
    preservedIds.push(record.record_id)
  }
  await execSql(
    database,
    `INSERT INTO system_iam_role_permissions(role_id,permission_key)
    VALUES ('partner-test-manager','system:record:export');
    DROP TABLE partner_contracts;
    DROP TABLE partners;`,
  )
  const core = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => new Date())
      context.set("database", drizzle(database))
      await next()
    })
    .get("/system/preserved-records/:recordId/dossier", ...preservedDossier)
  for (const [index, recordId] of preservedIds.entries()) {
    const dossier = await core.request(
      `/system/preserved-records/${recordId}/dossier?purpose=archive`,
      { headers: { authorization: `Bearer ${token}` } },
      bindings,
    )
    if (dossier.status !== 200) throw new Error(await dossier.text())
    const body = z
      .object({
        source: z.object({ ownerContext: z.string(), recordKind: z.string() }),
        contentBase64: z.string(),
        execution: z.object({ caseId: z.string() }),
        auditReceipts: z.array(z.unknown()),
      })
      .parse(await dossier.json())
    expect(body.source).toMatchObject({
      ownerContext: "partner",
      recordKind: sources[index]?.[0],
    })
    const content = JSON.parse(Buffer.from(body.contentBase64, "base64").toString("utf8"))
    expect(content.format).toBe(sources[index]?.[0])
  }
})
