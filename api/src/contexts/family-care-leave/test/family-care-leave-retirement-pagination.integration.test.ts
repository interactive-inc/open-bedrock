import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { expect, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createFamilyCareLeavePreservationFixture } from "@/contexts/family-care-leave/test/create-family-care-leave-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { GET as preservedDossier } from "@system/interface/routes/system.preserved-records.$recordId.dossier"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { drizzle } from "drizzle-orm/d1"

// 複数ページの保全・承認・再検証を実HTTPとDBで通すため、個別に実行時間を確保する。
test("11件のfamily care leave記録を全件保全し、人の承認・取消・再提出を経て原記録を残して撤去確定する", async () => {
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
  } = await createFamilyCareLeavePreservationFixture()
  const creator = zAccountId.parse(creatorPerson.accountId)
  const familyCareLeaveIds = Array.from(
    { length: 11 },
    (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  )
  const conditions = {
    reason: "Preserve original",
    preservation: { kind: "hold" as const, retainUntil: null, reason: "Retain evidence" },
    disclosure: { reason: "Restricted archive", grants: [] },
  }
  await database.exec(`INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('role:retirement-review','retirement:review','custom','Record reviewer',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('role:retirement-review','system:procedure:read')`)
  await database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
    VALUES ('binding:retirement-review',?1,'role:retirement-review',0)`)
    .bind(reviewer.accountId)
    .run()
  for (const id of familyCareLeaveIds) {
    const index = familyCareLeaveIds.indexOf(id) + 1
    await database
      .prepare(`INSERT INTO family_care_leaves
      (id,employee_id,leave_kind,start_date,end_date,note,status,created_at)
      VALUES (?1,?2,'family_care',?3,?4,?5,'requested',?6)`)
      .bind(
        id,
        creatorPerson.employeeId,
        `2026-${String(index).padStart(2, "0")}-01`,
        `2026-${String(index).padStart(2, "0")}-02`,
        `Leave ${index}`,
        `2026-${String(index).padStart(2, "0")}-01T01:00:00Z`,
      )
      .run()
  }
  expect(
    await database
      .prepare("SELECT count(*) AS total FROM family_care_leaves")
      .first<number>("total"),
  ).toBe(11)
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
    (
      await post("/family-care-leave/record-source-freezes", freezeId, {
        reason: "Preserve family-care-leave",
      })
    ).status,
  ).toBe(201)
  const frozenInsert = await database
    .prepare(`INSERT INTO family_care_leaves
      (id,employee_id,leave_kind,start_date,end_date,note,status,created_at)
      VALUES (?1,?2,'family_care','2030-01-01','2030-01-02',NULL,'requested','2030-01-01T00:00:00Z')`)
    .bind(crypto.randomUUID(), creatorPerson.employeeId)
    .run()
    .then(
      () => null,
      (error: unknown) => error,
    )
  expect(frozenInsert).toBeInstanceOf(Error)
  const frozenFamilyCareLeavePath = `/family-care-leave/family-care-leaves/${familyCareLeaveIds[0]}`
  const frozenUpdate = await apiRequest(frozenFamilyCareLeavePath, {
    method: "PUT",
    body: {
      leave_kind: "family_care",
      start_date: "2031-01-01",
      end_date: "2031-01-02",
      note: "Must not be updated",
    },
  })
  if (frozenUpdate.status !== 409)
    throw new Error(
      `unexpected frozen update response: ${frozenUpdate.status} ${await frozenUpdate.text()}`,
    )
  expect((await apiRequest(frozenFamilyCareLeavePath, { method: "DELETE" })).status).toBe(409)
  const mappings = []
  for (const id of familyCareLeaveIds) {
    const path = `/family-care-leave/family-care-leaves/${id}/preservation-requests`
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
    const proposal = await new SystemD1ProposalAdapter({ env: { DB: database } }).findByNumber(
      record.number,
    )
    if (proposal === null || proposal instanceof Error)
      throw new Error("missing preservation proposal")
    const approvalResponse = await apiRequest(`${path}/${record.number}/approve`, {
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
    if (approvalResponse.status !== 200) throw new Error(await approvalResponse.text())
    expect(
      (
        await apiRequest(`${path}/${record.number}/execute`, {
          method: "POST",
          body: { proposal_digest: proposal.digest },
        })
      ).status,
    ).toBe(200)
    mappings.push({ sourceRecordId: id, preservedRecordId: record.record_id })
  }
  const sourcePath = `/family-care-leave/record-source-freezes/${freezeId}`
  const planId = crypto.randomUUID()
  const firstCoverage = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
    purpose: "archive",
    records: mappings.slice(0, 10),
  })
  if (firstCoverage.status !== 200) throw new Error(await firstCoverage.text())
  expect(await firstCoverage.json()).toMatchObject({
    sequence: 1,
    nextCursor: familyCareLeaveIds[9],
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
  expect(publicPlan).toMatchObject({ totalPages: 2, recordKinds: ["family-care-leave-record"] })
  const retirementPath = `/family-care-leave/retirement-plans/${planId}/requests`
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "family-care-leave-retirement",
    revision: 1,
    title: "Retire preserved family-care-leave",
    category: "system",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: JSON.parse(definition.decisionPolicyJson),
    completionOperationKey: "system.record.retire",
    createdByAccountId: creator,
    createdAt: at,
  })
  if (retirementDefinition instanceof Error) throw retirementDefinition
  expect(
    await new SystemD1ProcedureRepository(governance.context).publish(retirementDefinition, 0),
  ).toBe(true)
  const requestBody = {
    plan_digest: publicPlan.digest,
    procedure_key: retirementDefinition.key,
    reason: "Keep company records after removal",
  }
  const requestId = crypto.randomUUID()
  expect((await post(retirementPath, requestId, requestBody)).status).toBe(503)
  const verificationPath = `/family-care-leave/retirement-plans/${planId}/verification-receipts`
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
    await database.prepare("SELECT count(*) AS n FROM family_care_leaves").first<number>("n"),
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
  const proposalReader = new SystemD1ProposalAdapter({
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
    comment: "Reviewed preserved family-care-leave",
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
  await database.exec(
    "CREATE TRIGGER fail_family_care_leave_retirement BEFORE INSERT ON system_record_source_retirements BEGIN SELECT RAISE(ABORT,'injected finalization failure'); END;",
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
  await database.exec("DROP TRIGGER fail_family_care_leave_retirement")
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
    await database.prepare("SELECT count(*) AS n FROM family_care_leaves").first<number>("n"),
  ).toBe(11)
  expect(
    (
      await post(`${sourcePath}/release`, crypto.randomUUID(), {
        reason: "Cannot restart retired source",
      })
    ).status,
  ).toBe(409)
  await database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('family-care-leave-test-manager','system:record:export'); DROP TABLE family_care_leaves;",
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
