import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { expect, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createAssetPreservationFixture } from "@/contexts/asset/test/create-asset-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { GET as preservedDossier } from "@system/interface/routes/system.preserved-records.$recordId.dossier"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { drizzle } from "drizzle-orm/d1"
import {
  assetRecordKinds,
  encodeStocktakeItemRecordId,
  type AssetRecordKind,
} from "@/contexts/asset/domain/definitions/asset-record-kind.definition"

// 複数ページの保全・承認・再検証を実HTTPとDBで通すため、個別に実行時間を確保する。
test("資産・貸与・棚卸し・棚卸し明細を全件保全し、人の承認を経て4台帳を撤去確定する", async () => {
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
  } = await createAssetPreservationFixture()
  const creator = zAccountId.parse(creatorPerson.accountId)
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
  for (let id = 1; id <= 11; id++) {
    const code = `A${String(id).padStart(4, "0")}`
    await database
      .prepare(`INSERT INTO assets
      (code,name,kind,serial,purchased_on,status,holder_employee_id,disposed_on,disposal_reason)
      VALUES (?1,?2,'pc',?3,'2026-01-01','in_stock',NULL,NULL,NULL)`)
      .bind(code, `Asset ${id}`, `SERIAL-${id}`)
      .run()
  }
  await database
    .prepare(`INSERT INTO asset_lendings
    (id,asset_code,employee_id,lent_at,returned_at) VALUES ('01900015-0000-7000-8000-000000000001','A0001',?1,'2026-01-02T00:00:00Z','2026-01-03T00:00:00Z')`)
    .bind(creatorPerson.employeeId)
    .run()
  const stocktakeId = "a1b2c3d4-e5f6-4a1b-8c2d-000000000001"
  await database
    .prepare(`INSERT INTO stocktakes
    (id,name,target_date,status,created_at,closed_at) VALUES (?1,'Annual stocktake','2026-04-01','closed','2026-04-01T00:00:00Z','2026-04-02T00:00:00Z')`)
    .bind(stocktakeId)
    .run()
  await database
    .prepare(`INSERT INTO stocktake_items
    (stocktake_id,asset_code,checked_at,checker_employee_id,location_note)
    VALUES (?1,'A0001','2026-04-01T01:00:00Z',?2,'Office')`)
    .bind(stocktakeId, creatorPerson.employeeId)
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
    (await post("/asset/record-source-freezes", freezeId, { reason: "Preserve asset" })).status,
  ).toBe(201)
  expect(
    await database
      .prepare("SELECT count(*) AS n FROM system_procedure_definitions WHERE key=?1")
      .bind(definition.key)
      .first<number>("n"),
  ).toBe(1)
  await expect(
    database.prepare("UPDATE assets SET name='Must not change' WHERE code='A0001'").run(),
  ).rejects.toThrow("asset_record_source_frozen")
  await expect(
    database
      .prepare("UPDATE stocktakes SET name='Must not change' WHERE id=?1")
      .bind(stocktakeId)
      .run(),
  ).rejects.toThrow("asset_record_source_frozen")
  await expect(
    database
      .prepare(
        "UPDATE stocktake_items SET location_note='Must not change' WHERE stocktake_id=?1 AND asset_code='A0001'",
      )
      .bind(stocktakeId)
      .run(),
  ).rejects.toThrow("asset_record_source_frozen")
  await expect(
    database
      .prepare(`INSERT INTO asset_lendings
      (id,asset_code,employee_id,lent_at,returned_at)
      VALUES ('01900015-0000-7000-8000-000000000002','A0002',?1,'2026-01-04T00:00:00Z',NULL)`)
      .bind(creatorPerson.employeeId)
      .run(),
  ).rejects.toThrow("asset_record_source_frozen")
  expect(
    (
      await apiRequest("/asset/assets", {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: {
          code: "BLOCKED",
          name: "Blocked asset",
          kind: "pc",
        },
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await apiRequest("/asset/assets/A0001", {
        method: "PUT",
        body: {
          name: "Must not change",
          kind: "pc",
        },
      })
    ).status,
  ).toBe(409)
  const sourceRecords: ReadonlyArray<Readonly<{ recordKind: AssetRecordKind; recordId: string }>> =
    [
      ...Array.from({ length: 11 }, (_, index) => ({
        recordKind: "asset-record" as const,
        recordId: `A${String(index + 1).padStart(4, "0")}`,
      })),
      { recordKind: "asset-lending-record", recordId: "01900015-0000-7000-8000-000000000001" },
      { recordKind: "stocktake-record", recordId: stocktakeId },
      {
        recordKind: "stocktake-item-record",
        recordId: encodeStocktakeItemRecordId(stocktakeId, "A0001"),
      },
    ]
  const mappings: Array<{
    recordKind: AssetRecordKind
    sourceRecordId: string
    preservedRecordId: string
  }> = []
  for (const sourceRecord of sourceRecords) {
    const path = `/asset/records/${sourceRecord.recordKind}/${encodeURIComponent(sourceRecord.recordId)}/preservation-requests`
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
  const sourcePath = `/asset/record-source-freezes/${freezeId}`
  const planId = crypto.randomUUID()
  const assetMappings = mappings.filter((mapping) => mapping.recordKind === "asset-record")
  const coverageRecords = (records: typeof mappings) =>
    records.map(({ sourceRecordId, preservedRecordId }) => ({ sourceRecordId, preservedRecordId }))
  const firstCoverage = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
    purpose: "archive",
    recordKind: "asset-record",
    records: coverageRecords(assetMappings.slice(0, 10)),
  })
  if (firstCoverage.status !== 200) throw new Error(await firstCoverage.text())
  expect(await firstCoverage.json()).toMatchObject({
    sequence: 1,
    nextCursor: "A0010",
    recordCount: 10,
  })
  expect(
    (await post(`${sourcePath}/retirement-plans`, planId, { purpose: "archive" })).status,
  ).toBe(503)
  const lastCoverage = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
    purpose: "archive",
    recordKind: "asset-record",
    records: coverageRecords(assetMappings.slice(10)),
  })
  if (lastCoverage.status !== 200) throw new Error(await lastCoverage.text())
  expect(await lastCoverage.json()).toMatchObject({ sequence: 2, nextCursor: null, recordCount: 1 })
  for (const recordKind of assetRecordKinds.slice(1)) {
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
  expect(publicPlan).toMatchObject({ totalPages: 5, recordKinds: assetRecordKinds })
  const retirementPath = `/asset/retirement-plans/${planId}/requests`
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "asset-retirement",
    revision: 1,
    title: "Retire preserved asset",
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
  const verificationPath = `/asset/retirement-plans/${planId}/verification-receipts`
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
  for (const ordinal of [2, 3, 4, 5]) {
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
  ).toBe(5)
  expect(await database.prepare("SELECT count(*) AS n FROM assets").first<number>("n")).toBe(11)
  expect(
    await database.prepare("SELECT count(*) AS n FROM asset_lendings").first<number>("n"),
  ).toBe(1)
  expect(await database.prepare("SELECT count(*) AS n FROM stocktakes").first<number>("n")).toBe(1)
  expect(
    await database.prepare("SELECT count(*) AS n FROM stocktake_items").first<number>("n"),
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
    comment: "Reviewed preserved asset",
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
    "CREATE TRIGGER fail_asset_retirement BEFORE INSERT ON system_record_source_retirements BEGIN SELECT RAISE(ABORT,'injected finalization failure'); END;",
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
  await database.exec("DROP TRIGGER fail_asset_retirement")
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
  expect(await database.prepare("SELECT count(*) AS n FROM assets").first<number>("n")).toBe(11)
  // 端末の実時計は数 ms 巻き戻ることがある。巻き戻った実時計の下でも、解除は再認証ではなく停止世代の競合で拒否する。
  // 拒否理由の code まで比べ、権限や再認証の拒否と取り違えたときに経路が分かるようにする。
  const wallClock = Date.now
  const rewound = wallClock() - 5
  Date.now = () => rewound
  const release = await (async () => {
    try {
      return await post(`${sourcePath}/release`, crypto.randomUUID(), {
        reason: "Cannot restart retired source",
      })
    } finally {
      Date.now = wallClock
    }
  })()
  expect({ status: release.status, body: await release.json() }).toMatchObject({
    status: 409,
    body: { code: "record_source_freeze_conflict" },
  })
  await database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('asset-test-manager','system:record:export'); DROP TABLE stocktake_items; DROP TABLE stocktakes; DROP TABLE asset_lendings; DROP TABLE assets;",
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
