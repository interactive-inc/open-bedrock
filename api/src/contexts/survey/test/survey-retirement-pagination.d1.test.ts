import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createSurveyPreservationFixture } from "@/contexts/survey/test/create-survey-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { GET as preservedDossier } from "@system/interface/routes/system.preserved-records.$recordId.dossier"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { drizzle } from "drizzle-orm/d1"
import {
  surveyRecordKinds,
  type SurveyRecordKind,
} from "@/contexts/survey/domain/definitions/survey-record-kind.definition"
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
test("アンケート・回答記録を全件保全し、人の承認を経て2台帳を撤去確定する", async () => {
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
  } = await createSurveyPreservationFixture(await pool.next())
  const creator = zAccountId.parse(creatorPerson.accountId)
  const conditions = {
    reason: "Preserve original",
    preservation: { kind: "hold" as const, retainUntil: null, reason: "Retain evidence" },
    disclosure: { reason: "Restricted archive", grants: [] },
  }
  await execSql(
    database,
    `INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('role:retirement-review','retirement:review','custom','Record reviewer',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('role:retirement-review','system:procedure:read')`,
  )
  await database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
    VALUES ('binding:retirement-review',?1,'role:retirement-review',0)`)
    .bind(reviewer.accountId)
    .run()
  for (let id = 1; id <= 11; id++) {
    await database
      .prepare(`INSERT INTO surveys (id,title,status,questions_json)
        VALUES (?1,?2,?3,'[]')`)
      .bind(id, `Survey ${id}`, id === 11 ? "closed" : "open")
      .run()
  }
  await database
    .prepare(`INSERT INTO survey_responses
      (id,survey_id,respondent_id,answers_json,submitted_at)
      VALUES (1,1,?1,'{}','2026-01-02T00:00:00.000Z')`)
    .bind(creatorPerson.employeeId)
    .run()
  const at = clock()
  const token = await tokenFor(creator)
  const stepUpToken = "e".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  await database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at) VALUES ('pagination-grant',?1,?2,'external_identity',?3,?4)`)
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
    (await post("/survey/record-source-freezes", freezeId, { reason: "Preserve survey" })).status,
  ).toBe(201)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_procedure_definitions WHERE key=?1")
      .bind(definition.key)
      .first<number>("n"),
  ).toBe(1)
  await expect(
    database.prepare("UPDATE surveys SET title='Must not change' WHERE id=1").run(),
  ).rejects.toThrow("survey_record_source_frozen")
  await expect(
    database
      .prepare(`INSERT INTO survey_responses
      (survey_id,respondent_id,answers_json,submitted_at)
      VALUES (2,?1,'{}','2026-01-03T00:00:00.000Z')`)
      .bind(creatorPerson.employeeId)
      .run(),
  ).rejects.toThrow("survey_record_source_frozen")
  const blockedWrites = [
    await apiRequest("/survey/surveys", {
      method: "POST",
      body: { title: "Blocked survey", status: "open", questions_json: [] },
    }),
    await apiRequest("/survey/surveys/1", {
      method: "PUT",
      body: { title: "Must not change", status: "open", questions_json: [] },
    }),
    await apiRequest("/survey/surveys/11", { method: "DELETE" }),
    await apiRequest("/survey/surveys/2/responses", {
      method: "POST",
      body: { answers_json: {} },
    }),
    await apiRequest("/survey/surveys/responses/1", {
      method: "PUT",
      body: { answers_json: { changed: true } },
    }),
    await apiRequest("/survey/surveys/responses/1", { method: "DELETE" }),
  ]
  expect(blockedWrites.map((response) => response.status)).toEqual([409, 409, 409, 409, 409, 409])
  for (const response of blockedWrites) {
    expect(await response.json()).toMatchObject({ code: "record_source_frozen" })
  }
  const sourceRecords: ReadonlyArray<Readonly<{ recordKind: SurveyRecordKind; recordId: string }>> =
    [
      ...Array.from({ length: 11 }, (_, index) => ({
        recordKind: "survey-record" as const,
        recordId: String(index + 1),
      })),
      { recordKind: "survey-response-record", recordId: "1" },
    ]
  const mappings: Array<{
    recordKind: SurveyRecordKind
    sourceRecordId: string
    preservedRecordId: string
  }> = []
  for (const sourceRecord of sourceRecords) {
    const path = `/survey/records/${sourceRecord.recordKind}/${encodeURIComponent(sourceRecord.recordId)}/preservation-requests`
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
  const sourcePath = `/survey/record-source-freezes/${freezeId}`
  const planId = crypto.randomUUID()
  const surveyMappings = mappings.filter((mapping) => mapping.recordKind === "survey-record")
  const coverageRecords = (records: typeof mappings) =>
    records.map(({ sourceRecordId, preservedRecordId }) => ({ sourceRecordId, preservedRecordId }))
  const firstCoverage = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
    purpose: "archive",
    recordKind: "survey-record",
    records: coverageRecords(surveyMappings.slice(0, 10)),
  })
  if (firstCoverage.status !== 200) throw new Error(await firstCoverage.text())
  expect(await firstCoverage.json()).toMatchObject({
    sequence: 1,
    nextCursor: "10",
    recordCount: 10,
  })
  expect(
    (await post(`${sourcePath}/retirement-plans`, planId, { purpose: "archive" })).status,
  ).toBe(503)
  const lastCoverage = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
    purpose: "archive",
    recordKind: "survey-record",
    records: coverageRecords(surveyMappings.slice(10)),
  })
  if (lastCoverage.status !== 200) throw new Error(await lastCoverage.text())
  expect(await lastCoverage.json()).toMatchObject({ sequence: 2, nextCursor: null, recordCount: 1 })
  for (const recordKind of surveyRecordKinds.slice(1)) {
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
  expect(publicPlan).toMatchObject({ totalPages: 3, recordKinds: surveyRecordKinds })
  const retirementPath = `/survey/retirement-plans/${planId}/requests`
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "survey-retirement",
    revision: 1,
    title: "Retire preserved survey",
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
  const verificationPath = `/survey/retirement-plans/${planId}/verification-receipts`
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
  for (const ordinal of [2, 3]) {
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
  ).toBe(3)
  expect(await database.prepare("SELECT count(*) AS n FROM surveys").first<number>("n")).toBe(11)
  expect(
    await database.prepare("SELECT count(*) AS n FROM survey_responses").first<number>("n"),
  ).toBe(1)
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
    comment: "Reviewed preserved survey",
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
    "CREATE TRIGGER fail_survey_retirement BEFORE INSERT ON system_record_source_retirements BEGIN SELECT RAISE(ABORT,'injected finalization failure'); END;",
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
  await execSql(database, "DROP TRIGGER fail_survey_retirement")
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
  expect(await database.prepare("SELECT count(*) AS n FROM surveys").first<number>("n")).toBe(11)
  expect(
    (
      await post(`${sourcePath}/release`, crypto.randomUUID(), {
        reason: "Cannot restart retired source",
      })
    ).status,
  ).toBe(409)
  await execSql(
    database,
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('survey-test-manager','system:record:export'); DROP TABLE survey_responses; DROP TABLE surveys;",
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
