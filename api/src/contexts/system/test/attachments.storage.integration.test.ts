import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"
import { preparePreservedRecordWriteAuthorization } from "@system/interface/authorization/prepare-preserved-record-write-authorization"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { RevalidateSystemExecutionAttestationsAdapter } from "@system/infrastructure/adapters/workflow/revalidate-system-execution-attestations.adapter"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { PreservedRecordDisclosurePolicyRepository } from "@system/infrastructure/repositories/records/preserved-record-disclosure-policy.repository"
import { DisclosePreservedRecordPersistenceAdapter } from "@system/infrastructure/adapters/records/disclose-preserved-record-persistence.adapter"
import { FinalizePreservedRecordPersistenceAdapter } from "@system/infrastructure/adapters/records/finalize-preserved-record-persistence.adapter"
import { GET as RECORD_CONTENT } from "@system/interface/routes/system.preserved-records.$recordId.content"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { SystemHTTPException } from "@system/interface/errors"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { DisclosePreservedRecordContent } from "@system/application/records/disclose-preserved-record-content"
import { FinalizePreservedRecord } from "@system/application/records/finalize-preserved-record"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { readFileSync } from "node:fs"
import { VerifyPreservedRecordContentAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-content.adapter"
import { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { PreservedRecordPayloadValue } from "@system/domain/values/records/preserved-record-payload.value"
import { StorePreservedRecordContent } from "@system/application/records/store-preserved-record-content"
import { decryptAttachment } from "@system/application/attachments/lib/decrypt-attachment"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { describe, expect, spyOn, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { systemAttachmentSchema } from "@system/infrastructure/schema/system-attachment"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"

const ownerAccountId = "acc_owner"

const now = new Date("2026-08-20T09:00:00.000Z")

function receiptBytes(): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode("%PDF-1.7 領収書 12,800円 タクシー")
}

function createContext(
  bucket: SystemAttachmentTestBucket,
  kekEnv: string = createSystemAttachmentTestKekEnvironment(1),
) {
  const db = createSystemAttachmentTestDatabase()

  return {
    var: { database: drizzle(db, { schema: { ...systemCoreSchema, ...systemAttachmentSchema } }) },
    env: { DB: db, ATTACHMENTS: bucket as unknown as R2Bucket, ATTACHMENT_KEKS: kekEnv },
  }
}

describe("添付の保管と取り出し", () => {
  test("保管すると pending になり、object storage には暗号文だけが置かれる", async () => {
    const bucket = new SystemAttachmentTestBucket()

    const context = createContext(bucket)

    const plaintext = receiptBytes()

    const stored = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "領収書.pdf",
      contentType: "application/pdf",
      content: plaintext,
      now,
    })

    if (stored instanceof Error) throw stored

    expect(stored.byteSize).toBe(plaintext.byteLength)

    const row = await new AttachmentAdapter(context).findById(stored.id)

    if (row instanceof Error || row === null) throw new Error("行が無い")

    expect(row.status).toBe("pending")
    expect(row.ownerAccountId).toBe(ownerAccountId)
    expect(row.objectKey).toBe(`att/${stored.id}`)

    // object key にファイル名を含めない（ファイル名自体が個人情報になり得る）
    expect(row.objectKey).not.toContain("領収書")
    expect(bucket.keys()).toEqual([`att/${stored.id}`])

    const bytes = bucket.storedBytes(`att/${stored.id}`)

    if (bytes === null) throw new Error("本体が無い")

    expect(bytes).not.toEqual(plaintext)
    expect(new TextDecoder().decode(bytes)).not.toContain("領収書")
  })

  test("許可していない形式と上限超過を拒否する", async () => {
    const bucket = new SystemAttachmentTestBucket()

    const context = createContext(bucket)

    const rejectedType = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "script.exe",
      contentType: "application/octet-stream",
      content: receiptBytes(),
      now,
    })

    expect(rejectedType).toBeInstanceOf(Error)

    const rejectedSize = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "huge.pdf",
      contentType: "application/pdf",
      content: new Uint8Array(25 * 1024 * 1024 + 1),
      now,
    })

    expect(rejectedSize).toBeInstanceOf(Error)

    // 拒否したものは object storage にも行にも残らない
    expect(bucket.size()).toBe(0)
  })

  test("KEK 未設定では保管も取り出しもできない", async () => {
    const bucket = new SystemAttachmentTestBucket()

    const context = {
      ...createContext(bucket),
      env: { ATTACHMENTS: bucket as unknown as R2Bucket, ATTACHMENT_KEKS: undefined },
    }

    const stored = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "領収書.pdf",
      contentType: "application/pdf",
      content: receiptBytes(),
      now,
    })

    expect(stored).toBeInstanceOf(Error)
  })
})

describe("業務レコードへの紐づけ", () => {})

test("同じ保存先への再書き込みと競合は元の暗号文を上書きしない", async () => {
  const bucket = new SystemAttachmentTestBucket()
  const adapter = new AttachmentObjectAdapter(createContext(bucket))
  const original = new Uint8Array([1, 2, 3])
  const replacement = new Uint8Array([4, 5, 6])
  const results = await Promise.all([
    adapter.put("att/immutable-object", original),
    adapter.put("att/immutable-object", replacement),
  ])
  expect(results.filter((result) => result instanceof Error)).toHaveLength(1)
  expect(bucket.storedBytes("att/immutable-object")).toEqual(original)
  expect(await adapter.put("att/immutable-object", original)).toBeInstanceOf(Error)
  expect(bucket.storedBytes("att/immutable-object")).toEqual(original)
})

test("原記録の本文と不足する来歴を暗号化保存し、空の元ファイルも復元できる", async () => {
  for (const fixture of [
    {
      text: "abc",
      digest: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      base64: "YWJj",
    },
    {
      text: "",
      digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      base64: "",
    },
  ]) {
    const bucket = new SystemAttachmentTestBucket()
    const context = createContext(bucket)
    const source = {
      sourceNamespace: "source-tenant-1",
      ownerContext: "sample-records",
      recordKind: "record",
      recordId: "original-1",
      formatId: "sample-record",
      formatVersion: 1,
      sourceRevision: null,
      sourceRecordedAt: null,
      capturedAt: now.toISOString(),
      contentDigest: fixture.digest,
    }
    const prepared = await new StorePreservedRecordContent(context).execute({
      source,
      content: new TextEncoder().encode(fixture.text),
      ownerAccountId,
      now,
    })
    if (prepared instanceof Error) throw prepared
    const row = await new AttachmentAdapter(context).findById(prepared.attachment.id)
    if (row === null || row instanceof Error) throw new Error("missing prepared attachment")
    expect(row.status).toBe("pending")
    const recordInput = {
      id: crypto.randomUUID(),
      source,
      attachmentId: row.id,
      attachmentDigest: row.plaintextSha256,
      preservationId: crypto.randomUUID(),
      disclosurePolicyId: crypto.randomUUID(),
      disclosurePolicyRevision: 1,
      sourceAuthorizationRef: {
        context: "sample-records",
        kind: "export-grant",
        id: "grant-1",
        version: "1",
      },
      actorAccountId: ownerAccountId,
      finalizedAt: now.toISOString(),
      reason: "Preserve original",
      auditEventId: crypto.randomUUID(),
    }
    const record = PreservedRecordEntity.create(recordInput)
    if (record instanceof Error) throw record
    const verified = await new VerifyPreservedRecordContentAdapter(context).execute(
      record,
      "pending",
    )
    if (verified instanceof Error) throw verified
    expect(new TextDecoder().decode(verified.payload.content.toBytes())).toBe(fixture.text)
    for (const mismatch of [
      { ...recordInput, actorAccountId: "other-owner" },
      { ...recordInput, attachmentDigest: "f".repeat(64) },
      { ...recordInput, source: { ...source, sourceNamespace: "other-source" } },
      { ...recordInput, source: { ...source, sourceRevision: "invented-revision" } },
    ]) {
      const different = PreservedRecordEntity.create(mismatch)
      if (different instanceof Error) throw different
      expect(
        await new VerifyPreservedRecordContentAdapter(context).execute(different, "pending"),
      ).toBeInstanceOf(Error)
    }
    const ciphertext = await new AttachmentObjectAdapter(context).get(row.objectKey)
    if (ciphertext instanceof Error) throw ciphertext
    const registry = AttachmentKekRegistry.fromEnv(context.env.ATTACHMENT_KEKS)
    if (registry instanceof Error) throw registry
    if (row.wrappedDek === null || row.wrappedDekIv === null)
      throw new Error("prepared content key is unavailable")
    const decoded = await decryptAttachment(
      ciphertext,
      {
        wrappedDek: row.wrappedDek,
        wrappedDekIv: row.wrappedDekIv,
        contentIv: row.contentIv,
        kekVersion: row.kekVersion,
      },
      registry.current(),
    )
    if (decoded instanceof Error) throw decoded
    expect(new TextDecoder().decode(ciphertext)).not.toContain("source-tenant-1")
    const restored = await PreservedRecordPayloadValue.restore(decoded, prepared.source)
    if (restored instanceof Error) throw restored
    expect(new TextDecoder().decode(restored.content.toBytes())).toBe(fixture.text)
    expect(JSON.parse(new TextDecoder().decode(decoded))).toEqual({
      version: 1,
      source,
      contentBase64: fixture.base64,
    })
    const ordinaryUpload = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "record.json",
      contentType: prepared.attachment.contentType,
      content: decoded,
      now,
    })
    expect(ordinaryUpload).toBeInstanceOf(Error)
    expect(bucket.size()).toBe(1)
    await bucket.put(row.objectKey, new Uint8Array([1, 2, 3]).buffer)
    expect(
      await new VerifyPreservedRecordContentAdapter(context).execute(record, "pending"),
    ).toBeInstanceOf(Error)
    expect(await new AttachmentAdapter(context).findById(row.id)).toMatchObject({
      status: "pending",
    })
  }
})

test("encrypted original is verified before atomic finalization and failed source authority leaves it pending", async () => {
  const now = new Date()
  for (const scenario of [
    "purge-before-submission",
    "denied",
    "allowed",
    "revoked-during-read",
    "reviewer-suspended-during-read",
    "permission-revoked-during-read",
  ]) {
    const allowed = scenario === "allowed"
    const bucket = new SystemAttachmentTestBucket()
    const context = createContext(bucket)
    await context.env.DB.exec(
      readFileSync(
        new URL("../infrastructure/schema/system-record-preservation.sql", import.meta.url),
        "utf8",
      ),
    )
    await context.env.DB.exec(
      `CREATE TABLE test_source_authority (allowed INTEGER); INSERT INTO test_source_authority VALUES (${Number(scenario !== "denied")})`,
    )
    const prepared = await new StorePreservedRecordContent(context).execute({
      source: {
        sourceNamespace: "sample-source",
        ownerContext: "sample-records",
        recordKind: "record",
        recordId: "source-1",
        formatId: "sample-record",
        formatVersion: 1,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: now.toISOString(),
        contentDigest: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      },
      content: new TextEncoder().encode("abc"),
      ownerAccountId,
      now,
    })
    if (prepared instanceof Error) throw prepared
    const row = await new AttachmentAdapter(context).findById(prepared.attachment.id)
    if (row instanceof Error || row === null) throw new Error("missing pending attachment")
    const record = PreservedRecordEntity.create({
      id: crypto.randomUUID(),
      source: prepared.source.props,
      attachmentId: row.id,
      attachmentDigest: row.plaintextSha256,
      preservationId: crypto.randomUUID(),
      disclosurePolicyId: crypto.randomUUID(),
      disclosurePolicyRevision: 1,
      sourceAuthorizationRef: {
        context: "sample-records",
        kind: "export-grant",
        id: "grant-1",
        version: "1",
      },
      actorAccountId: ownerAccountId,
      finalizedAt: now.toISOString(),
      reason: "Preserve original",
      auditEventId: crypto.randomUUID(),
    })
    if (record instanceof Error) throw record
    const disclosure = PreservedRecordDisclosurePolicyEntity.create({
      id: record.snapshot.disclosurePolicyId,
      revision: 1,
      recordId: record.snapshot.id,
      status: "active",
      publishedAt: now.toISOString(),
      actorAccountId: ownerAccountId,
      reason: "Authorized preservation",
      auditEventId: crypto.randomUUID(),
      grants: [
        ...["agent", "service", "connector"].map((kind) => ({
          accountId: `reader-${kind}`,
          actions: ["read"],
          purposes: ["review"],
          validFrom: now.toISOString(),
          validUntil: null,
        })),
        {
          accountId: "viewer",
          actions: ["read"],
          purposes: ["review"],
          validFrom: now.toISOString(),
          validUntil: new Date(now.getTime() + 3600000).toISOString(),
        },
        {
          accountId: "exporter",
          actions: ["export"],
          purposes: ["archive"],
          validFrom: now.toISOString(),
          validUntil: null,
        },
      ],
    })
    if (disclosure instanceof Error) throw disclosure
    const preservation = AttachmentPreservationEntity.create({
      id: record.snapshot.preservationId,
      attachmentId: row.id,
      sha256: row.plaintextSha256,
      kind: "hold",
      retainUntil: null,
      reason: "Preserve original",
      actorAccountId: ownerAccountId,
      createdAt: now.toISOString(),
      auditEventId: crypto.randomUUID(),
      revision: 1,
      release: null,
    })
    if (preservation instanceof Error) throw preservation
    for (const schema of [
      "system-decision-policy",
      "system-procedure-delegation",
      "system-human-decision",
    ])
      await context.env.DB.exec(
        readFileSync(new URL(`../infrastructure/schema/${schema}.sql`, import.meta.url), "utf8"),
      )
    for (const accountId of [ownerAccountId, "archive-reviewer"]) {
      await context.env.DB.prepare(
        "INSERT INTO system_accounts(id,status,created_at,updated_at) VALUES (?1,'active',0,0)",
      )
        .bind(accountId)
        .run()
      await context.env.DB.prepare(
        "INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES (?1,?2,'human',?2,1,0,0)",
      )
        .bind(`principal:${accountId}`, accountId)
        .run()
    }
    await context.env.DB
      .exec(`INSERT INTO system_procedure_definitions(key,current_revision,status,created_at,updated_at) VALUES ('record-preservation',1,'active',0,0);
      INSERT INTO system_procedure_definition_revisions(procedure_key,revision,title,category,input_schema_json,decision_policy_json,created_by_account_id,created_at)
      VALUES ('record-preservation',1,'Preserve records','operation','{}','{}','${ownerAccountId}',0)`)
    const proposal = await RecordPreservationProposalValue.fromRequest({
      request: {
        reason: record.snapshot.reason,
        preservation: {
          kind: preservation.snapshot.kind,
          retainUntil: preservation.snapshot.retainUntil,
          reason: preservation.snapshot.reason,
        },
        disclosure: {
          reason: disclosure.snapshot.reason,
          grants: disclosure.snapshot.grants,
        },
      },
      recordId: record.snapshot.id,
      source: prepared.source,
      actorAccountId: ownerAccountId,
      attachmentId: row.id,
      attachmentDigest: row.plaintextSha256,
      sourceAuthorizationRef: record.snapshot.sourceAuthorizationRef,
      preservationId: preservation.snapshot.id,
      disclosurePolicyId: disclosure.snapshot.id,
    })
    if (proposal instanceof Error) throw proposal
    const later = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const threshold = new Date(later.getTime() - 24 * 60 * 60 * 1000)
    const beforeSubmission = await new AttachmentAdapter(context).listStaleUnlinked(
      threshold,
      100,
      later,
    )
    if (beforeSubmission instanceof Error) throw beforeSubmission
    expect(beforeSubmission.map((attachment) => attachment.id)).toContain(row.id)
    const verifiedForSubmission = await new VerifyPreservedRecordContentAdapter(context).execute(
      record,
      "pending",
    )
    if (verifiedForSubmission instanceof Error) throw verifiedForSubmission
    const submissionGuard = new PrepareAttachmentContentReadGuardAdapter(context).prepare(
      verifiedForSubmission.attachment,
      now,
      "pending",
    )
    if (scenario === "purge-before-submission") {
      const claimed = await new AttachmentAdapter(context).claimUnlinkedPurge(
        row.id,
        threshold,
        later,
      )
      if (claimed instanceof Error || claimed === null)
        throw new Error("purge did not claim pending attachment")
      expect(claimed.status).toBe("erased")
    }
    const writer = new SystemD1WorkflowAdapter({ ...context, startGuards: [submissionGuard] })
    const started = await new StartSystemProcedure({ writer }).run({
      seriesId: crypto.randomUUID(),
      version: 1,
      procedureKey: "record-preservation",
      procedureRevision: 1,
      body: JSON.parse(proposal.props.canonical.toString()),
      createdByAccountId: zAccountId.parse(ownerAccountId),
      supersedesProposalId: null,
      createdAt: now,
      subject: {
        context: "system",
        kind: "record-preservation",
        id: record.snapshot.id,
        version: "1",
      },
      firstTask: {
        key: "review",
        requiredApprovals: 1,
        openedAt: now,
        dueAt: null,
        excludedAccountIds: [zAccountId.parse(ownerAccountId)],
        candidates: [
          {
            accountId: zAccountId.parse("archive-reviewer"),
            source: "primary",
            evidenceContext: "sample-source",
            evidenceKind: "qualification",
            evidenceId: "preservation-reviewer",
            evidenceVersion: "1",
            eligibilityDigest: proposal.props.digest.toString(),
            eligibleFrom: null,
            resolvedAt: now,
          },
        ],
      },
    })
    if (scenario === "purge-before-submission") {
      expect(started).toBeInstanceOf(Error)
      expect(
        await context.env.DB.prepare(
          "SELECT count(*) AS count FROM system_proposals",
        ).first<number>("count"),
      ).toBe(0)
      expect(
        await context.env.DB.prepare("SELECT count(*) AS count FROM system_cases").first<number>(
          "count",
        ),
      ).toBe(0)
      expect(
        await context.env.DB.prepare(
          "SELECT count(*) AS count FROM system_decision_tasks",
        ).first<number>("count"),
      ).toBe(0)
      continue
    }
    if (started instanceof Error) throw started
    expect(started.proposal.digest).toBe(proposal.props.digest.toString())
    const stale = await new AttachmentAdapter(context).listStaleUnlinked(threshold, 100, later)
    if (stale instanceof Error) throw stale
    expect(stale.map((attachment) => attachment.id)).not.toContain(row.id)
    expect(
      await new AttachmentAdapter(context).claimUnlinkedPurge(row.id, threshold, later),
    ).toBeNull()
    const approved = await new ApproveSystemTask(writer).execute({
      caseId: started.workflowCase.id,
      taskKey: "review",
      round: 1,
      actorAccountId: zAccountId.parse("archive-reviewer"),
      representedAccountId: zAccountId.parse("archive-reviewer"),
      delegationId: null,
      proposalDigest: started.proposal.digest,
      comment: "Preserve original evidence",
      decidedAt: now,
      nextTask: null,
    })
    expect(approved).toEqual({ caseStatus: "approved", taskOutcome: "approved" })
    const executionEvidence = await new RevalidateSystemExecutionAttestationsAdapter(
      context,
    ).prepare({ caseId: started.workflowCase.id, executedAt: now })
    if (executionEvidence instanceof Error) throw executionEvidence
    expect(executionEvidence.attestations).toHaveLength(1)
    const authorization = ExecutionAuthorizationEntity.create({
      id: crypto.randomUUID(),
      caseId: started.workflowCase.id,
      operationKey: "system.record.preserve",
      proposalDigest: started.proposal.digest,
      grantedToAccountId: ownerAccountId,
      grantedAt: now,
      expiresAt: new Date(now.getTime() + 3600000),
      usedAt: null,
    })
    if (authorization instanceof Error) throw authorization
    await context.env.DB.exec(
      "INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('preserver-role','record:preserver','custom','Preserver',0,0); INSERT INTO system_iam_role_permissions VALUES ('preserver-role','system:record:preserve')",
    )
    await context.env.DB.prepare(
      "INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES ('preserver-binding',?1,'preserver-role',0)",
    )
      .bind(ownerAccountId)
      .run()
    const technical = await preparePreservedRecordWriteAuthorization(context, {
      authentication: {
        accountId: zAccountId.parse(ownerAccountId),
        tokenVersion: 0,
        issuedAtMs: now.getTime(),
        expiresAtMs: now.getTime() + 3600000,
        machineCredentialId: null,
        identityBindingId: null,
      },
      at: now,
    })
    if (technical === null || technical instanceof Error)
      throw new Error("missing preservation permission")
    const technicalGuards = technical.assertions(now)
    if (technicalGuards instanceof Error) throw technicalGuards
    const application = new FinalizePreservedRecord({
      ...context,
      persistence: new FinalizePreservedRecordPersistenceAdapter({
        ...context,
        authorization,
        executionGuards: [executionEvidence.guard],
        assertions: [
          context.env.DB.prepare(
            "SELECT CASE WHEN (SELECT allowed FROM test_source_authority) = 1 THEN 1 ELSE json_extract('', '$') END",
          ),
          ...technicalGuards,
        ],
      }),
    })
    const getObject = bucket.get.bind(bucket)
    const reads: string[] = []
    const read = spyOn(bucket, "get").mockImplementation(async (key) => {
      reads.push(key)
      const object = await getObject(key)
      if (scenario === "revoked-during-read")
        await context.env.DB.exec("UPDATE test_source_authority SET allowed = 0")
      if (scenario === "permission-revoked-during-read")
        await context.env.DB.exec(
          "DELETE FROM system_iam_role_permissions WHERE role_id = 'preserver-role'",
        )
      if (scenario === "reviewer-suspended-during-read")
        await context.env.DB.prepare(
          "UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1, updated_at = ?1 WHERE id = 'archive-reviewer' AND status = 'active'",
        )
          .bind(now.getTime())
          .run()
      return object
    })
    const attempts = await Promise.all([
      application.execute({ record, disclosure, preservation }),
      application.execute({ record, disclosure, preservation }),
    ])
    read.mockRestore()
    if (scenario === "denied") expect(reads).toHaveLength(0)
    else expect(reads.length).toBeGreaterThan(0)
    for (const completed of attempts) expect(completed instanceof Error).toBe(!allowed)
    if (allowed) {
      expect(await application.execute({ record, disclosure, preservation })).toEqual(record)
      const approvedIntent = await RecordPreservationProposalValue.restore(started.proposal.body)
      if (approvedIntent instanceof Error) throw approvedIntent
      const replay = approvedIntent.toFinalization({
        actorAccountId: ownerAccountId,
        at: new Date(now.getTime() + 1000),
      })
      if (replay instanceof Error) throw replay
      expect(await application.execute(replay)).toEqual(record)

      const changedPolicy = PreservedRecordDisclosurePolicyEntity.create({
        ...disclosure.snapshot,
        reason: "Changed disclosure intent",
      })
      if (changedPolicy instanceof Error) throw changedPolicy
      expect(
        await application.execute({ record, disclosure: changedPolicy, preservation }),
      ).toBeInstanceOf(Error)
      const changedHold = AttachmentPreservationEntity.create({
        ...preservation.snapshot,
        reason: "Changed retention intent",
      })
      if (changedHold instanceof Error) throw changedHold
      expect(
        await application.execute({ record, disclosure, preservation: changedHold }),
      ).toBeInstanceOf(Error)
      const clock = { at: now }
      const reader = new DisclosePreservedRecordContent({
        ...context,
        accountId: "viewer",
        now: () => clock.at,
        persistence: new DisclosePreservedRecordPersistenceAdapter({
          ...context,
          assertions: [
            context.env.DB.prepare(
              "SELECT CASE WHEN (SELECT allowed FROM test_source_authority) = 1 THEN 1 ELSE json_extract('', '$') END",
            ),
          ],
        }),
      })
      const request = { recordId: record.snapshot.id, action: "read", purpose: "review" }
      expect(await reader.execute({ ...request, action: "export" })).toBeInstanceOf(Error)
      expect(await reader.execute({ ...request, purpose: "other" })).toBeInstanceOf(Error)
      const original = await reader.execute(request)
      if (original instanceof Error) throw original
      expect(new TextDecoder().decode(original.content)).toBe("abc")
      expect(original.source.sourceRecordedAt).toBeNull()
      const exporter = new DisclosePreservedRecordContent({
        ...context,
        accountId: "exporter",
        now: () => clock.at,
        persistence: new DisclosePreservedRecordPersistenceAdapter({
          ...context,
          assertions: [
            context.env.DB.prepare(
              "SELECT CASE WHEN (SELECT allowed FROM test_source_authority) = 1 THEN 1 ELSE json_extract('', '$') END",
            ),
          ],
        }),
      })
      expect(await exporter.execute(request)).toBeInstanceOf(Error)
      const exported = await exporter.execute({
        recordId: record.snapshot.id,
        action: "export",
        purpose: "archive",
      })
      if (exported instanceof Error) throw exported
      expect(new TextDecoder().decode(exported.content)).toBe("abc")
      await context.env.DB.exec(
        "INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES ('viewer','active',0,100,100); INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES ('viewer-principal','viewer','human','Viewer',1,100,100); INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('record-reader','record:reader','custom','Reader',100,100); INSERT INTO system_iam_role_permissions VALUES ('record-reader','system:record:read'); INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES ('record-binding','viewer','record-reader',100)",
      )
      const secret = "record-http-test-secret-only"
      const token = await new SystemAccessTokenIssuer(secret).issue({
        accountId: zAccountId.parse("viewer"),
        tokenVersion: 0,
        now,
      })
      if (token instanceof Error) throw token
      const http = systemFactory
        .createApp()
        .use("*", async (c, next) => {
          c.set("now", () => clock.at)
          c.set("database", context.var.database)
          await next()
        })
        .get("/system/preserved-records/:recordId/content", ...RECORD_CONTENT)
        .onError((error, c) => {
          if (error instanceof SystemHTTPException)
            return c.json({ error: error.code }, error.status)
          return c.json({ error: "unexpected" }, 500)
        })
      const endpoint = `/system/preserved-records/${record.snapshot.id}/content?action=read&purpose=review`
      const environment = { ...context.env, JWT_SECRET: secret }
      const headers = { authorization: `Bearer ${token}` }
      expect((await http.request(endpoint, {}, environment)).status).toBe(401)
      expect(
        (
          await http.request(
            endpoint.replace("action=read", "action=export"),
            { headers },
            environment,
          )
        ).status,
      ).toBe(403)
      expect(
        (
          await http.request(
            endpoint.replace("purpose=review", "purpose=other"),
            { headers },
            environment,
          )
        ).status,
      ).toBe(403)
      const response = await http.request(endpoint, { headers }, environment)
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(response.headers.get("content-type")).toBe("application/octet-stream")
      expect(response.headers.get("x-content-type-options")).toBe("nosniff")
      expect(await response.text()).toBe("abc")
      for (const kind of ["agent", "service", "connector"]) {
        const accountId = `reader-${kind}`
        const credentialId = `credential-${kind}`
        if (kind === "connector")
          await context.env.DB.exec(
            "INSERT INTO system_connectors(id,key,name,direction,transport,status,revision,created_at,updated_at) VALUES ('record-connector','record-connector','Record connector','bidirectional','api','active',1,100,100)",
          )
        await context.env.DB.prepare(
          "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,100,100)",
        )
          .bind(accountId)
          .run()
        await context.env.DB.prepare(
          "INSERT INTO system_principals(id,account_id,kind,name,connector_id,revision,created_at,updated_at) VALUES (?1,?1,?2,'Reader',?3,1,100,100)",
        )
          .bind(accountId, kind, kind === "connector" ? "record-connector" : null)
          .run()
        await context.env.DB.prepare(
          "INSERT INTO system_machine_credentials(id,principal_id,name,secret_hash,status,created_at,updated_at,last_used_at,expires_at) VALUES (?1,?2,'Reader credential',?3,'active',100,?4,?4,?5)",
        )
          .bind(
            credentialId,
            accountId,
            ["agent", "service", "connector"].indexOf(kind).toString(16).repeat(64),
            now.getTime(),
            now.getTime() + 60000,
          )
          .run()
        await context.env.DB.prepare(
          "INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES (?1,?1,'record-reader',100)",
        )
          .bind(accountId)
          .run()
        const machineToken = await new SystemAccessTokenIssuer(secret).issue({
          accountId: zAccountId.parse(accountId),
          tokenVersion: 0,
          machineCredentialId: credentialId,
          now,
        })
        if (machineToken instanceof Error) throw machineToken
        const machineHeaders = { authorization: `Bearer ${machineToken}` }
        const machineResponse = await http.request(
          endpoint,
          { headers: machineHeaders },
          environment,
        )
        expect(machineResponse.status).toBe(200)
        expect(await machineResponse.text()).toBe("abc")
        await context.env.DB.prepare(
          "UPDATE system_machine_credentials SET status='revoked', revoked_at=?1 WHERE id=?2",
        )
          .bind(now.getTime(), credentialId)
          .run()
        expect(
          (await http.request(endpoint, { headers: machineHeaders }, environment)).status,
        ).toBe(401)
      }
      await context.env.DB.exec(
        "DELETE FROM system_iam_role_permissions WHERE role_id = 'record-reader'",
      )
      expect((await http.request(endpoint, { headers }, environment)).status).toBe(403)
      await context.env.DB.exec(
        "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES ('exporter','active',0,100,100); INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES ('export-principal','exporter','human','Exporter',1,100,100); INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('export-role','record:exporter','custom','Exporter',100,100); INSERT INTO system_iam_role_permissions VALUES ('export-role','system:record:export'); INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES ('export-binding','exporter','export-role',100)",
      )
      const exportToken = await new SystemAccessTokenIssuer(secret).issue({
        accountId: zAccountId.parse("exporter"),
        tokenVersion: 0,
        now,
      })
      if (exportToken instanceof Error) throw exportToken
      const exportResponse = await http.request(
        `/system/preserved-records/${record.snapshot.id}/content?action=export&purpose=archive&format=package`,
        { headers: { authorization: `Bearer ${exportToken}` } },
        environment,
      )
      expect(exportResponse.status).toBe(200)
      expect(exportResponse.headers.get("content-type")).toBe(
        "application/vnd.record-preservation+json",
      )
      expect(exportResponse.headers.get("cache-control")).toBe("no-store")
      const packageBytes = new Uint8Array(await exportResponse.arrayBuffer())
      const restoredPackage = await PreservedRecordPayloadValue.restore(packageBytes, record.source)
      if (restoredPackage instanceof Error) throw restoredPackage
      expect(new TextDecoder().decode(restoredPackage.content.toBytes())).toBe("abc")
      expect(restoredPackage.source.props.sourceRevision).toBeNull()
      expect(restoredPackage.source.props.sourceRecordedAt).toBeNull()
      expect(
        (await http.request(`${endpoint}&format=package`, { headers }, environment)).status,
      ).toBe(400)
      const originalGet = bucket.get.bind(bucket)
      const expire = spyOn(bucket, "get").mockImplementation(async (key) => {
        const object = await originalGet(key)
        clock.at = new Date(now.getTime() + 3600000)
        return object
      })
      try {
        expect(await reader.execute(request)).toBeInstanceOf(Error)
      } finally {
        expire.mockRestore()
        clock.at = now
      }
      await context.env.DB.exec(
        "CREATE TRIGGER test_disclosure_audit_failure BEFORE INSERT ON system_audit_events WHEN NEW.action = 'system.record.disclosed' BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;",
      )
      try {
        expect(await reader.execute(request)).toBeInstanceOf(Error)
      } finally {
        await context.env.DB.exec("DROP TRIGGER test_disclosure_audit_failure")
      }
      const revoke = spyOn(bucket, "get").mockImplementation(async (key) => {
        const object = await originalGet(key)
        await context.env.DB.exec("UPDATE test_source_authority SET allowed = 0")
        return object
      })
      try {
        expect(await reader.execute(request)).toBeInstanceOf(Error)
      } finally {
        revoke.mockRestore()
      }
      expect(await application.execute({ record, disclosure, preservation })).toBeInstanceOf(Error)
      await context.env.DB.exec("UPDATE test_source_authority SET allowed = 1")
      const revokedPolicy = PreservedRecordDisclosurePolicyEntity.create({
        ...disclosure.snapshot,
        revision: 2,
        status: "revoked",
        reason: "Withdraw disclosure",
        auditEventId: crypto.randomUUID(),
      })
      if (revokedPolicy instanceof Error) throw revokedPolicy
      const revocationAudit = SystemAuditEventEntity.restore({
        eventId: revokedPolicy.snapshot.auditEventId,
        actorAccountId: ownerAccountId,
        action: "system.record.disclosure_policy.published",
        targetType: "system:record-disclosure-policy",
        targetId: revokedPolicy.snapshot.id,
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: null,
        beforeJson: JSON.stringify(disclosure.snapshot),
        afterJson: JSON.stringify(revokedPolicy.snapshot),
        metadataJson: null,
        occurredAtEpochMilliseconds: now.getTime(),
      })
      if (revocationAudit instanceof Error) throw revocationAudit
      const revokePolicy = spyOn(bucket, "get").mockImplementation(async (key) => {
        const object = await originalGet(key)
        await context.env.DB.batch([
          ...new PreservedRecordDisclosurePolicyRepository({
            ...context,
            assertions: [context.env.DB.prepare("SELECT 1")],
          }).preparePublish(revokedPolicy, revocationAudit),
        ])
        return object
      })
      try {
        expect(await reader.execute(request)).toBeInstanceOf(Error)
        expect(revokePolicy).toHaveBeenCalledTimes(1)
      } finally {
        revokePolicy.mockRestore()
      }
    }
    expect(
      await context.env.DB.prepare(
        "SELECT count(*) AS count FROM system_execution_authorizations WHERE used_at IS NOT NULL",
      ).first<{ count: number }>(),
    ).toEqual({ count: Number(allowed) })
    expect(
      await context.env.DB.prepare("SELECT status FROM system_cases WHERE id = ?1")
        .bind(authorization.caseId)
        .first<{ status: string }>(),
    ).toEqual({ status: allowed ? "executed" : "approved" })
    const stored = await new AttachmentAdapter(context).findById(row.id)
    expect(stored).toMatchObject({ status: allowed ? "linked" : "pending" })
    expect(
      await context.env.DB.prepare("SELECT count(*) AS count FROM system_preserved_records").first<{
        count: number
      }>(),
    ).toEqual({ count: Number(allowed) })
    expect(
      await context.env.DB.prepare("SELECT count(*) AS count FROM system_audit_events").first<{
        count: number
      }>(),
    ).toEqual({ count: allowed ? 11 : 0 })
  }
})
