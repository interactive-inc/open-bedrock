import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { drizzle } from "drizzle-orm/d1"
import { createAttendancePreservationFixture } from "@/contexts/attendance/test/create-attendance-preservation-fixture.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { GET as preservedRecords } from "@system/interface/routes/system.preserved-records"
import { GET as preservedContent } from "@system/interface/routes/system.preserved-records.$recordId.content"
import { GET as preservedDossier } from "@system/interface/routes/system.preserved-records.$recordId.dossier"
import { GET as proposalHistory } from "@system/interface/routes/system.proposals.$number.versions.$version"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
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

const receiptSchema = z.object({ number: z.number(), case_id: z.string(), record_id: z.string() })
const reviewSchema = z.object({
  decision_target: z.object({
    proposal_version: z.number(),
    proposal_digest: z.string(),
    task_key: z.string(),
    task_round: z.number(),
  }),
  original: z.object({ contentBase64: z.string() }).nullable(),
})

test("打刻の取下げ・否決・再提出・承認・確定後、業務テーブルと経路がなくても原記録と証跡を出力できる", async () => {
  const f = await createAttendancePreservationFixture(await pool.next())
  await execSql(
    f.database,
    `INSERT INTO system_iam_role_permissions VALUES
    ('role:attendance-archive','system:record:preserve'),
    ('role:attendance-archive','system:procedure:read');
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('role:archive-review','archive:review','custom','Review reader',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('role:archive-review','system:procedure:read');`,
  )
  await f.database
    .prepare(
      "INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES ('binding:archive-review',?1,'role:archive-review',0)",
    )
    .bind(f.reviewer.accountId)
    .run()
  const conditions = {
    ...f.conditions,
    disclosure: {
      reason: "Approved archive access",
      grants: [
        {
          accountId: f.governance.creator.accountId,
          actions: ["read", "export"],
          purposes: ["archive"],
          validFrom: new Date().toISOString(),
          validUntil: null,
        },
      ],
    },
  }
  const body = { ...f.command.body, conditions }
  const submitted = await f.request(f.path, { ...f.command, body })
  expect(submitted.status).toBe(201)
  const receipt = receiptSchema.parse(await submitted.json())
  const path = `${f.path}/${receipt.number}`
  expect((await f.request(path, { anonymous: true })).status).toBe(401)
  expect((await f.request(path, {})).status).toBe(403)
  const firstRead = await f.request(`${path}?include_original=true`, {
    accountId: f.reviewer.accountId,
  })
  if (firstRead.status !== 200)
    throw new Error(`review failed: ${firstRead.status} ${await firstRead.text()}`)
  expect(firstRead.headers.get("cache-control")).toBe("no-store")
  const first = reviewSchema.parse(await firstRead.json())
  expect(first.original).not.toBeNull()
  const withdrawal = {
    body: {
      proposal_digest: first.decision_target.proposal_digest,
      reason: "Correct source before review",
    },
  }
  expect(
    (await f.request(`${path}/withdraw`, { ...withdrawal, accountId: f.reviewer.accountId }))
      .status,
  ).toBe(403)
  expect((await f.request(`${path}/withdraw`, withdrawal)).status).toBe(200)
  expect((await f.request(`${path}/withdraw`, withdrawal)).status).toBe(409)
  await execSql(
    f.database,
    "UPDATE attendance_records SET note='Corrected before approval' WHERE id='01900016-0000-7000-8000-000000000001'",
  )
  const secondResponse = await f.request(`${path}/resubmit`, {
    body: {
      ...body,
      previous_version: first.decision_target.proposal_version,
      previous_digest: first.decision_target.proposal_digest,
    },
  })
  expect(secondResponse.status).toBe(201)
  const secondReceipt = receiptSchema.parse(await secondResponse.json())
  const secondPath = `${f.path}/${secondReceipt.number}`
  expect(
    (
      await f.request(`${secondPath}/approve`, {
        accountId: f.reviewer.accountId,
        body: { comment: null, decision_target: first.decision_target },
      })
    ).status,
  ).toBe(409)
  const secondRead = await f.request(secondPath, { accountId: f.reviewer.accountId })
  expect(secondRead.status).toBe(200)
  const second = reviewSchema.parse(await secondRead.json())
  expect(second.original).toBeNull()
  expect(second.decision_target.proposal_version).toBe(2)
  const rejected = await f.request(`${secondPath}/reject`, {
    accountId: f.reviewer.accountId,
    body: { comment: "Recheck retention", decision_target: second.decision_target },
  })
  expect(rejected.status).toBe(200)
  expect(await rejected.json()).toEqual({ status: "rejected" })
  const thirdResponse = await f.request(`${secondPath}/resubmit`, {
    body: {
      ...body,
      previous_version: second.decision_target.proposal_version,
      previous_digest: second.decision_target.proposal_digest,
    },
  })
  expect(thirdResponse.status).toBe(201)
  const finalReceipt = receiptSchema.parse(await thirdResponse.json())
  const finalPath = `${f.path}/${finalReceipt.number}`
  const finalRead = await f.request(`${finalPath}?include_original=true`, {
    accountId: f.reviewer.accountId,
  })
  expect(finalRead.status).toBe(200)
  const final = reviewSchema.parse(await finalRead.json())
  expect(final.decision_target.proposal_version).toBe(3)
  if (final.original === null) throw new Error("missing original")
  const original = JSON.parse(Buffer.from(final.original.contentBase64, "base64").toString("utf8"))
  expect(original).toMatchObject({
    format: "attendance-record",
    version: 3,
    record: {
      id: "01900016-0000-7000-8000-000000000001",
      legacy_id: null,
      note: "Corrected before approval",
    },
  })
  const approved = await f.request(`${finalPath}/approve`, {
    accountId: f.reviewer.accountId,
    body: { comment: "Reviewed captured original", decision_target: final.decision_target },
  })
  expect(approved.status).toBe(200)
  expect(
    (
      await f.request(`${finalPath}/execute`, {
        body: { proposal_digest: final.decision_target.proposal_digest },
      })
    ).status,
  ).toBe(200)
  await execSql(
    f.database,
    "DROP TABLE attendance_records; INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:record:export')",
  )
  const core = systemFactory
    .createApp()
    .use("*", async (c, next) => {
      c.set("now", () => new Date())
      c.set("database", drizzle(f.database))
      await next()
    })
    .get("/system/preserved-records", ...preservedRecords)
    .get("/system/preserved-records/:recordId/content", ...preservedContent)
    .get("/system/preserved-records/:recordId/dossier", ...preservedDossier)
    .get("/system/proposals/:number/versions/:version", ...proposalHistory)
  const secret = "attendance-isolated-export-test"
  const token = await new SystemAccessTokenIssuer(secret).issue({
    accountId: f.governance.creator.accountId,
    tokenVersion: 0,
    now: new Date(),
  })
  if (token instanceof Error) throw token
  const env = { DB: f.database, JWT_SECRET: secret, ...f.recordStorage }
  const headers = { authorization: `Bearer ${token}` }
  expect((await core.request(finalPath, { headers }, env)).status).toBe(404)
  const list = await core.request(
    "/system/preserved-records?action=export&purpose=archive&owner_context=attendance",
    { headers },
    env,
  )
  expect(list.status).toBe(200)
  expect(await list.json()).toMatchObject({
    records: [
      {
        recordId: finalReceipt.record_id,
        source: { ownerContext: "attendance", sourceRevision: null, sourceRecordedAt: null },
      },
    ],
    nextCursor: null,
  })
  const contentPath = `/system/preserved-records/${finalReceipt.record_id}/content?action=export&purpose=archive&format=package`
  expect((await core.request(contentPath, {}, env)).status).toBe(401)
  const exported = await core.request(contentPath, { headers }, env)
  expect(exported.status).toBe(200)
  const envelope = z.object({ contentBase64: z.string() }).parse(await exported.json())
  expect(JSON.parse(Buffer.from(envelope.contentBase64, "base64").toString("utf8"))).toEqual(
    original,
  )
  const history = await core.request(
    `/system/proposals/${finalReceipt.number}/versions/3`,
    { headers },
    env,
  )
  expect(history.status).toBe(200)
  expect(await history.json()).toMatchObject({
    digest: final.decision_target.proposal_digest,
    case: { id: finalReceipt.case_id, status: "executed" },
    attestations: [{ actorAccountId: f.reviewer.accountId, action: "approve" }],
  })
  const dossierPath = `/system/preserved-records/${finalReceipt.record_id}/dossier?purpose=archive`
  expect((await core.request(dossierPath, { headers }, env)).status).toBe(403)
  await execSql(
    f.database,
    "INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:admin')",
  )
  const dossier = await core.request(dossierPath, { headers }, env)
  if (dossier.status !== 200)
    throw new Error(`dossier failed: ${dossier.status} ${await dossier.text()}`)
  expect(await dossier.json()).toMatchObject({
    version: 1,
    contentBase64: envelope.contentBase64,
    execution: { caseId: finalReceipt.case_id },
    approval: {
      candidates: expect.arrayContaining([
        expect.objectContaining({ accountId: f.reviewer.accountId, evidenceContext: "company" }),
      ]),
    },
  })
  expect(
    (
      await core.request(
        contentPath.replace("purpose=archive", "purpose=unapproved"),
        { headers },
        env,
      )
    ).status,
  ).toBe(403)
})
