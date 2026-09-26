import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createCareerPreservationFixture } from "@/contexts/career/test/create-career-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { GET as preservedDossier } from "@system/interface/routes/system.preserved-records.$recordId.dossier"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { drizzle } from "drizzle-orm/d1"
import {
  careerRecordKinds,
  type CareerRecordKind,
} from "@/contexts/career/domain/definitions/career-record-kind.definition"
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

/** 公募の固定 UUID。末尾の連番と辞書順が一致するので、ページの並びは移行前の整数の主キーと同じになる。 */
function postingId(serial: number): string {
  return `01900017-0000-7000-8000-${serial.toString(16).padStart(12, "0")}`
}

test("キャリア公募・応募・シート記録を全件保全し、人の承認を経て3台帳を撤去確定する", async () => {
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
  } = await createCareerPreservationFixture(await pool.next())
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
  for (let id = 1; id <= 11; id++) {
    await database
      .prepare(`INSERT INTO career_postings
        (id,title,dept_id,dept_name,required_skills,status)
        VALUES (?1,?2,NULL,NULL,NULL,?3)`)
      .bind(postingId(id), `Career posting ${id}`, id === 11 ? "closed" : "open")
      .run()
  }
  await database
    .prepare(`INSERT INTO career_applications (id,posting_id,applicant_id,message,status)
      VALUES ('01900018-0000-7000-8000-000000000001','01900017-0000-7000-8000-000000000001',?1,'Original application','applied')`)
    .bind(creatorPerson.employeeId)
    .run()
  await database
    .prepare(`INSERT INTO career_sheets (employee_id,goals_text,strengths_text,updated_at)
      VALUES (?1,'Goal','Strength','2026-01-02T00:00:00.000Z')`)
    .bind(creatorPerson.employeeId)
    .run()
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
    (await post("/career/record-source-freezes", freezeId, { reason: "Preserve career" })).status,
  ).toBe(201)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_procedure_definitions WHERE key=?1")
      .bind(definition.key)
      .first<number>("n"),
  ).toBe(1)
  await expect(
    database
      .prepare(
        "UPDATE career_postings SET title='Must not change' WHERE id='01900017-0000-7000-8000-000000000001'",
      )
      .run(),
  ).rejects.toThrow("career_record_source_frozen")
  await expect(
    database
      .prepare(`INSERT INTO career_applications
      (id,posting_id,applicant_id,message,status) VALUES ('01900018-0000-7000-8000-000000000002','01900017-0000-7000-8000-000000000002',?1,NULL,'applied')`)
      .bind(creatorPerson.employeeId)
      .run(),
  ).rejects.toThrow("career_record_source_frozen")
  const blockedWrites = [
    await apiRequest("/career/career-postings", {
      method: "POST",
      body: {
        title: "Blocked",
        organization_unit_id: null,
        required_skills: null,
        status: "open",
      },
    }),
    await apiRequest("/career/career-postings/01900017-0000-7000-8000-000000000001", {
      method: "PUT",
      body: {
        title: "Must not change",
        organization_unit_id: null,
        required_skills: null,
        status: "open",
      },
    }),
    await apiRequest("/career/career-postings/01900017-0000-7000-8000-00000000000b", {
      method: "DELETE",
    }),
    await apiRequest("/career/career-postings/01900017-0000-7000-8000-000000000002/apply", {
      method: "POST",
      body: { message: "Blocked" },
    }),
    await apiRequest("/career/career-applications/01900018-0000-7000-8000-000000000001", {
      method: "PUT",
      body: { message: "Blocked" },
    }),
    await apiRequest("/career/career-applications/01900018-0000-7000-8000-000000000001", {
      method: "DELETE",
    }),
    await apiRequest("/career/career-sheets/me", {
      method: "PUT",
      body: { goals_text: "Blocked", strengths_text: null },
    }),
    await apiRequest("/career/career-sheets/me", { method: "DELETE" }),
  ]
  expect(blockedWrites.map((response) => response.status)).toEqual([
    409, 409, 409, 409, 409, 409, 409, 409,
  ])
  for (const response of blockedWrites) {
    expect(await response.json()).toMatchObject({ code: "record_source_frozen" })
  }
  const sourceRecords: ReadonlyArray<Readonly<{ recordKind: CareerRecordKind; recordId: string }>> =
    [
      ...Array.from({ length: 11 }, (_, index) => ({
        recordKind: "career-posting-record" as const,
        recordId: postingId(index + 1),
      })),
      { recordKind: "career-application-record", recordId: "01900018-0000-7000-8000-000000000001" },
      { recordKind: "career-sheet-record", recordId: creatorPerson.employeeId },
    ]
  const mappings: Array<{
    recordKind: CareerRecordKind
    sourceRecordId: string
    preservedRecordId: string
  }> = []
  for (const sourceRecord of sourceRecords) {
    const path = `/career/records/${sourceRecord.recordKind}/${encodeURIComponent(sourceRecord.recordId)}/preservation-requests`
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
    mappings.push({
      recordKind: sourceRecord.recordKind,
      sourceRecordId: sourceRecord.recordId,
      preservedRecordId: record.record_id,
    })
  }
  const sourcePath = `/career/record-source-freezes/${freezeId}`
  const planId = crypto.randomUUID()
  const postingMappings = mappings.filter(
    (mapping) => mapping.recordKind === "career-posting-record",
  )
  const coverageRecords = (records: typeof mappings) =>
    records.map(({ sourceRecordId, preservedRecordId }) => ({ sourceRecordId, preservedRecordId }))
  const firstCoverage = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
    purpose: "archive",
    recordKind: "career-posting-record",
    records: coverageRecords(postingMappings.slice(0, 10)),
  })
  if (firstCoverage.status !== 200) throw new Error(await firstCoverage.text())
  expect(await firstCoverage.json()).toMatchObject({
    sequence: 1,
    nextCursor: postingId(10),
    recordCount: 10,
  })
  expect(
    (await post(`${sourcePath}/retirement-plans`, planId, { purpose: "archive" })).status,
  ).toBe(503)
  const lastCoverage = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
    purpose: "archive",
    recordKind: "career-posting-record",
    records: coverageRecords(postingMappings.slice(10)),
  })
  if (lastCoverage.status !== 200) throw new Error(await lastCoverage.text())
  expect(await lastCoverage.json()).toMatchObject({ sequence: 2, nextCursor: null, recordCount: 1 })
  for (const recordKind of careerRecordKinds.slice(1)) {
    const records = mappings.filter((mapping) => mapping.recordKind === recordKind)
    const covered = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
      purpose: "archive",
      recordKind,
      records: coverageRecords(records),
    })
    if (covered.status !== 200) throw new Error(await covered.text())
    expect(await covered.json()).toMatchObject({ sequence: 1, nextCursor: null, recordCount: 1 })
  }
  const planned = await post(`${sourcePath}/retirement-plans`, planId, { purpose: "archive" })
  if (planned.status !== 200) throw new Error(await planned.text())
  const publicPlan = z
    .object({ digest: z.string(), totalPages: z.number(), recordKinds: z.array(z.string()) })
    .parse(await planned.json())
  expect(publicPlan).toMatchObject({ totalPages: 4, recordKinds: careerRecordKinds })
  const retirementPath = `/career/retirement-plans/${planId}/requests`
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "career-retirement",
    revision: 1,
    title: "Retire preserved career",
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
  const verificationPath = `/career/retirement-plans/${planId}/verification-receipts`
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
  for (const ordinal of [2, 3, 4]) {
    const receipt = await post(verificationPath, crypto.randomUUID(), {})
    if (receipt.status !== 200) throw new Error(await receipt.text())
    expect(await receipt.json()).toMatchObject({ ordinal, planId })
  }
  expect((await post(verificationPath, crypto.randomUUID(), {})).status).toBe(409)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_receipts WHERE plan_id=?1")
      .bind(planId)
      .first<number>("n"),
  ).toBe(4)
  expect(
    await database.prepare("SELECT count(*) AS n FROM career_postings").first<number>("n"),
  ).toBe(11)
  expect(
    await database.prepare("SELECT count(*) AS n FROM career_applications").first<number>("n"),
  ).toBe(1)
  expect(await database.prepare("SELECT count(*) AS n FROM career_sheets").first<number>("n")).toBe(
    1,
  )
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
    comment: "Reviewed preserved career",
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
    "CREATE TRIGGER fail_career_retirement BEFORE INSERT ON system_record_source_retirements BEGIN SELECT RAISE(ABORT,'injected finalization failure'); END;",
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
  await execSql(database, "DROP TRIGGER fail_career_retirement")
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
    await database.prepare("SELECT count(*) AS n FROM career_postings").first<number>("n"),
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
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('444b7459-cd96-42a1-8b10-f5c1befec5fb','system:record:export'); DROP TABLE career_applications; DROP TABLE career_sheets; DROP TABLE career_postings;",
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
