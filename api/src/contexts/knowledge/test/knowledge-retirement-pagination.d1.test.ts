import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createKnowledgePreservationFixture } from "@/contexts/knowledge/test/create-knowledge-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
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

// 複数ページの保全・承認・再検証を実HTTPとDBで通すため、個別に実行時間を確保する。
/** 旧来の連番と同じ順に並ぶ固定の記事 UUID。 */
function articleId(serial: number): string {
  return `01900042-0000-7000-8000-${serial.toString(16).padStart(12, "0")}`
}

test("11件のナレッジ記事と全改訂履歴を保全し、人の承認・取消・再提出を経て原記録を残して撤去確定する", async () => {
  const {
    clock,
    database,
    governance,
    creator: creatorPerson,
    reviewer,
    definition,
    bindings,
    tokenFor,
    request: apiRequest,
  } = await createKnowledgePreservationFixture(await pool.next())
  const creator = zAccountId.parse(creatorPerson.accountId)
  const conditions = {
    reason: "Preserve original",
    preservation: { kind: "hold" as const, retainUntil: null, reason: "Retain evidence" },
    disclosure: { reason: "Restricted archive", grants: [] },
  }
  await execSql(
    database,
    `INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('34736f76-bafd-432f-82c8-5910781358ff','retirement:review','custom','Record reviewer',0,0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('34736f76-bafd-432f-82c8-5910781358ff','system:procedure:read')`,
  )
  await database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
    VALUES ('765a5b2a-4515-48b7-8e45-6f0284f1d313',?1,'34736f76-bafd-432f-82c8-5910781358ff',0)`)
    .bind(reviewer.accountId)
    .run()
  for (const id of Array.from({ length: 11 }, (_, index) => index)) {
    const createdAt = `2026-08-${String(id + 1).padStart(2, "0")}T00:00:00Z`
    const initialSnapshot = JSON.stringify({
      id: articleId(id),
      revision: 1,
      status: "active",
      title: id === 2 ? "Knowledge 2 initial" : `Knowledge ${id}`,
      category: "handbook",
      tags: `tag-${id}`,
      bodyMd: id === 2 ? "Knowledge body 2 initial" : `Knowledge body ${id}`,
      authorId: creatorPerson.employeeId,
      createdAt,
    })
    const revision = id === 2 ? 2 : 1
    const title = id === 2 ? "Knowledge 2 revised" : `Knowledge ${id}`
    const body = id === 2 ? "Knowledge body 2 revised" : `Knowledge body ${id}`
    await database
      .prepare(`INSERT INTO knowledge_articles
      (id,title,category,tags,body_md,author_id,created_at,revision,status)
      VALUES (?1,?2,'handbook',?3,?4,?5,?6,?7,'active')`)
      .bind(articleId(id), title, `tag-${id}`, body, creatorPerson.employeeId, createdAt, revision)
      .run()
    await database
      .prepare(`INSERT INTO knowledge_article_revisions
      (id,article_id,revision,snapshot_json,status,source,actor_account_id,reason,recorded_at,command_id,request_json)
      VALUES (?4,?1,1,?2,'active','existing_record',NULL,'Initial article',?3,NULL,NULL)`)
      .bind(articleId(id), initialSnapshot, id, crypto.randomUUID())
      .run()
    if (id === 2) {
      const revisedSnapshot = JSON.stringify({
        ...JSON.parse(initialSnapshot),
        revision: 2,
        title,
        bodyMd: body,
      })
      await database
        .prepare(`INSERT INTO knowledge_article_revisions
        (id,article_id,revision,snapshot_json,status,source,actor_account_id,reason,recorded_at,command_id,request_json)
        VALUES (?3,?4,2,?1,'active','actor',?2,'Revised article',12,'knowledge-revision-2','{}')`)
        .bind(revisedSnapshot, creator, crypto.randomUUID(), articleId(2))
        .run()
    }
  }
  const at = clock()
  const token = await tokenFor(creator)
  const stepUpToken = "e".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  await database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at) VALUES ('9b4508ab-4bbb-4298-b4d7-7670fdb483de',?1,?2,'external_identity',?3,?4)`)
    .bind(creator, hash, at.getTime(), at.getTime() + 60_000)
    .run()
  const post = (path: string, id: string, body: unknown) =>
    app.request(
      path,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "idempotency-key": id,
          "x-system-step-up": stepUpToken,
        },
        body: JSON.stringify(body),
      },
      bindings,
    )
  const freezeId = crypto.randomUUID()
  expect(
    (await post("/knowledge/record-source-freezes", freezeId, { reason: "Preserve knowledge" }))
      .status,
  ).toBe(201)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_procedure_definitions WHERE key=?1")
      .bind(definition.key)
      .first<number>("n"),
  ).toBe(1)
  await expect(
    database
      .prepare(`UPDATE knowledge_articles SET title='Must not change' WHERE id='${articleId(1)}'`)
      .run(),
  ).rejects.toThrow("knowledge_record_source_frozen")
  await expect(
    database
      .prepare(`INSERT INTO knowledge_article_revisions
      (id,article_id,revision,snapshot_json,status,source,actor_account_id,reason,recorded_at,command_id,request_json)
      VALUES (?2,?3,2,'{}','active','actor',?1,'Blocked revision',1,'blocked-revision','{}')`)
      .bind(creator, crypto.randomUUID(), articleId(1))
      .run(),
  ).rejects.toThrow("knowledge_record_source_frozen")
  expect(
    (
      await apiRequest("/knowledge/knowledge-articles", {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: {
          title: "Blocked knowledge",
          category: "handbook",
          tags: null,
          body_md: "Must not be written",
          reason: "Frozen source",
        },
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await apiRequest(`/knowledge/knowledge-articles/${articleId(1)}`, {
        method: "PUT",
        headers: { "idempotency-key": crypto.randomUUID(), "if-match": '"1"' },
        body: {
          title: "Must not change",
          category: "handbook",
          tags: "tag-1",
          body_md: "Blocked update",
          reason: "Frozen source",
        },
      })
    ).status,
  ).toBe(409)
  const mappings = []
  for (const id of Array.from({ length: 11 }, (_, index) => index)) {
    const path = `/knowledge/knowledge-articles/${articleId(id)}/preservation-requests`
    const submitted = await apiRequest(path, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: {
        procedure_key: definition.key,
        conditions: {
          ...conditions,
          disclosure: {
            reason: "Archive verification",
            grants: [
              {
                accountId: creator,
                actions: ["read", "export"],
                purposes: ["archive"],
                validFrom: at.toISOString(),
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
    if (proposal === null || proposal instanceof Error)
      throw new Error("missing preservation proposal")
    expect(
      (
        await apiRequest(`${path}/${record.number}/approve`, {
          method: "POST",
          accountId: reviewer.accountId,
          body: {
            decision_target: {
              proposal_version: proposal.version,
              proposal_digest: proposal.digest,
              task_key: proposal.currentTaskKey,
              task_round: proposal.currentTaskRound,
            },
            comment: "Reviewed original",
          },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await apiRequest(`${path}/${record.number}/execute`, {
          method: "POST",
          body: { proposal_digest: proposal.digest },
        })
      ).status,
    ).toBe(200)
    mappings.push({ sourceRecordId: articleId(id), preservedRecordId: record.record_id })
  }
  expect(
    await database
      .prepare(
        "SELECT json_extract(snapshot_json,'$.source.sourceRevision') AS source_revision FROM system_preserved_records WHERE id=?1",
      )
      .bind(mappings[2]?.preservedRecordId)
      .first<string>("source_revision"),
  ).toBe("2")
  const sourcePath = `/knowledge/record-source-freezes/${freezeId}`
  const planId = crypto.randomUUID()
  const firstCoverage = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
    purpose: "archive",
    records: mappings.slice(0, 10),
  })
  if (firstCoverage.status !== 200) throw new Error(await firstCoverage.text())
  expect(await firstCoverage.json()).toMatchObject({
    sequence: 1,
    nextCursor: articleId(9),
    recordCount: 10,
  })
  expect(
    (await post(`${sourcePath}/retirement-plans`, planId, { purpose: "archive" })).status,
  ).toBe(503)
  const lastCoverage = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
    purpose: "archive",
    records: mappings.slice(10),
  })
  if (lastCoverage.status !== 200) throw new Error(await lastCoverage.text())
  expect(await lastCoverage.json()).toMatchObject({ sequence: 2, nextCursor: null, recordCount: 1 })
  const planned = await post(`${sourcePath}/retirement-plans`, planId, { purpose: "archive" })
  if (planned.status !== 200) throw new Error(await planned.text())
  const publicPlan = z
    .object({ digest: z.string(), totalPages: z.number(), recordKinds: z.array(z.string()) })
    .parse(await planned.json())
  expect(publicPlan).toMatchObject({ totalPages: 2, recordKinds: ["knowledge-article-record"] })
  const retirementPath = `/knowledge/retirement-plans/${planId}/requests`
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "knowledge-retirement",
    revision: 1,
    title: "Retire preserved knowledge",
    category: "system",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: JSON.parse(definition.decisionPolicyJson),
    completionOperationKey: "system.record.retire",
    createdByAccountId: creator,
    createdAt: at,
  })
  if (retirementDefinition instanceof Error) throw retirementDefinition
  expect(await openSystemProcedures(governance.context).publish(retirementDefinition, 0)).toBe(true)
  const requestBody = {
    plan_digest: publicPlan.digest,
    procedure_key: retirementDefinition.key,
    reason: "Keep company records after removal",
  }
  const requestId = crypto.randomUUID()
  expect((await post(retirementPath, requestId, requestBody)).status).toBe(503)
  const verificationPath = `/knowledge/retirement-plans/${planId}/verification-receipts`
  expect((await post(verificationPath, crypto.randomUUID(), { ordinal: 2 })).status).toBe(400)
  const firstId = crypto.randomUUID()
  const first = await post(verificationPath, firstId, {})
  if (first.status !== 200) throw new Error(await first.text())
  const firstReceipt = await first.json()
  expect(firstReceipt).toMatchObject({ ordinal: 1, planId })
  const replay = await post(verificationPath, firstId, {})
  expect(replay.status).toBe(200)
  expect(await replay.json()).toEqual(firstReceipt)
  const originalKeys = bindings.ATTACHMENT_KEKS
  bindings.ATTACHMENT_KEKS = "{}"
  expect((await post(verificationPath, firstId, {})).status).toBe(503)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_receipts WHERE plan_id=?1")
      .bind(planId)
      .first<number>("n"),
  ).toBe(1)
  bindings.ATTACHMENT_KEKS = originalKeys
  const last = await post(verificationPath, crypto.randomUUID(), {})
  if (last.status !== 200) throw new Error(await last.text())
  expect(await last.json()).toMatchObject({ ordinal: 2, planId })
  expect((await post(verificationPath, crypto.randomUUID(), {})).status).toBe(409)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_receipts WHERE plan_id=?1")
      .bind(planId)
      .first<number>("n"),
  ).toBe(2)
  expect(
    await database.prepare("SELECT count(*) AS n FROM knowledge_articles").first<number>("n"),
  ).toBe(11)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_record_source_retirements")
      .first<number>("n"),
  ).toBe(0)
  const submitted = await post(retirementPath, requestId, requestBody)
  if (submitted.status !== 201) throw new Error(await submitted.text())
  const request = z
    .object({ number: z.number(), proposalDigest: z.string(), status: z.string() })
    .parse(await submitted.json())
  expect(request.status).toBe("pending")
  expect((await post(retirementPath, requestId, requestBody)).status).toBe(200)
  expect(
    (await post(retirementPath, requestId, { ...requestBody, reason: "Changed intent" })).status,
  ).toBe(409)
  const proposalReader = openSystemProposals({
    env: { DB: database },
    visibleCompletionOperationKeys: ["system.record.retire"],
  })
  const saved = await proposalReader.findByNumber(request.number)
  if (saved === null || saved instanceof Error) throw new Error("missing retirement proposal")
  const executePath = `${retirementPath}/${request.number}/execute`
  const executeBody = {
    proposal_version: saved.version,
    proposal_digest: saved.digest,
    plan_digest: publicPlan.digest,
  }
  expect((await post(executePath, crypto.randomUUID(), executeBody)).status).toBe(409)
  const decisionBody = {
    decision_target: {
      proposal_version: saved.version,
      proposal_digest: saved.digest,
      task_key: saved.currentTaskKey,
      task_round: saved.currentTaskRound,
    },
    comment: "Reviewed preserved knowledge",
  }
  expect(
    (await post(`${retirementPath}/${request.number}/approve`, crypto.randomUUID(), decisionBody))
      .status,
  ).toBe(403)
  const reviewerToken = await tokenFor(reviewer.accountId)
  const decide = (action: string, body: unknown) =>
    app.request(
      `${retirementPath}/${request.number}/${action}`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${reviewerToken}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      bindings,
    )
  expect((await decide("reject", decisionBody)).status).toBe(200)
  expect((await post(executePath, crypto.randomUUID(), executeBody)).status).toBe(409)
  const resubmitted = await post(
    `${retirementPath}/${request.number}/resubmit`,
    crypto.randomUUID(),
    {
      ...requestBody,
      previous_version: saved.version,
      previous_digest: saved.digest,
    },
  )
  if (resubmitted.status !== 201) throw new Error(await resubmitted.text())
  expect(await resubmitted.json()).toMatchObject({ number: request.number, status: "pending" })
  const second = await proposalReader.findByNumber(request.number)
  if (second === null || second instanceof Error) throw new Error("missing retirement revision")
  expect(second.version).toBe(2)
  const withdrawal = {
    proposal_version: second.version,
    proposal_digest: second.digest,
    reason: "Recheck source removal",
  }
  expect((await decide("withdraw", withdrawal)).status).toBe(403)
  expect(
    (await post(`${retirementPath}/${request.number}/withdraw`, crypto.randomUUID(), withdrawal))
      .status,
  ).toBe(200)
  expect(
    (
      await post(`${retirementPath}/${request.number}/resubmit`, crypto.randomUUID(), {
        ...requestBody,
        previous_version: second.version,
        previous_digest: second.digest,
      })
    ).status,
  ).toBe(201)
  const latest = await proposalReader.findByNumber(request.number)
  if (latest === null || latest instanceof Error)
    throw new Error("missing final retirement proposal")
  expect(latest.version).toBe(3)
  expect((await decide("approve", decisionBody)).status).toBe(409)
  const latestDecision = {
    ...decisionBody,
    decision_target: {
      proposal_version: latest.version,
      proposal_digest: latest.digest,
      task_key: latest.currentTaskKey,
      task_round: latest.currentTaskRound,
    },
  }
  const approved = await decide("approve", latestDecision)
  if (approved.status !== 200) throw new Error(await approved.text())
  const finalBody = {
    proposal_version: latest.version,
    proposal_digest: latest.digest,
    plan_digest: publicPlan.digest,
  }
  const assignment = governance.resources.find(
    (resource) => resource.type === "responsibility-assignment",
  )
  if (assignment === undefined) throw new Error("missing company qualification")
  const reviewerAssignment = {
    ...assignment,
    attributes: {
      ...assignment.attributes,
      holderType: "employee",
      holderId: reviewer.employeeId,
      authorityScopeId: null,
    },
  }
  await governance.write([{ ...reviewerAssignment, revision: 3, state: "void" }])
  expect((await post(executePath, crypto.randomUUID(), finalBody)).status).toBe(403)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_record_source_retirements")
      .first<number>("n"),
  ).toBe(0)
  await governance.write([{ ...reviewerAssignment, revision: 4 }])
  bindings.ATTACHMENT_KEKS = "{}"
  expect((await post(executePath, crypto.randomUUID(), finalBody)).status).toBe(503)
  bindings.ATTACHMENT_KEKS = originalKeys
  await execSql(
    database,
    "CREATE TRIGGER fail_knowledge_retirement BEFORE INSERT ON system_record_source_retirements BEGIN SELECT RAISE(ABORT,'injected finalization failure'); END;",
  )
  expect((await post(executePath, crypto.randomUUID(), finalBody)).status).toBe(409)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_record_source_retirements")
      .first<number>("n"),
  ).toBe(0)
  expect(
    await database
      .prepare(
        "SELECT count(*) AS n FROM system_execution_authorizations WHERE case_id=?1 AND used_at IS NOT NULL",
      )
      .bind(latest.caseId)
      .first<number>("n"),
  ).toBe(0)
  expect(await proposalReader.findByNumber(request.number)).toMatchObject({ status: "approved" })
  await execSql(database, "DROP TRIGGER fail_knowledge_retirement")
  const finalized = await post(executePath, crypto.randomUUID(), finalBody)
  if (finalized.status !== 200) throw new Error(await finalized.text())
  const finalReceipt = await finalized.json()
  expect(await (await post(executePath, crypto.randomUUID(), finalBody)).json()).toEqual(
    finalReceipt,
  )
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_record_source_retirements")
      .first<number>("n"),
  ).toBe(1)
  expect(
    await database.prepare("SELECT count(*) AS n FROM knowledge_articles").first<number>("n"),
  ).toBe(11)
  expect(
    (
      await post(`${sourcePath}/release`, crypto.randomUUID(), {
        reason: "Cannot restart retired source",
      })
    ).status,
  ).toBe(409)
  await execSql(
    database,
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('d4d26dcf-544a-46d6-8c4a-62ccb10db409','system:record:export'); DROP TABLE knowledge_article_revisions; DROP TABLE knowledge_articles;",
  )
  const core = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => new Date())
      context.set("database", drizzle(database))
      await next()
    })
    .get("/system/preserved-records/:recordId/dossier", ...preservedDossier)
  for (const mapping of mappings) {
    const dossier = await core.request(
      `/system/preserved-records/${mapping.preservedRecordId}/dossier?purpose=archive`,
      { headers: { authorization: `Bearer ${token}` } },
      bindings,
    )
    if (dossier.status !== 200) throw new Error(await dossier.text())
    expect(await dossier.json()).toMatchObject({
      version: 1,
      execution: { caseId: expect.any(String) },
      approval: { candidates: expect.any(Array) },
      auditReceipts: expect.any(Array),
    })
  }
}, 30_000)
