import { DisclosePreservedRecordIndexPersistenceAdapter } from "@system/infrastructure/adapters/records/disclose-preserved-record-index-persistence.adapter"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { DisclosePreservedRecordIndex } from "@system/application/records/disclose-preserved-record-index"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { FinalizePreservedRecordPersistenceAdapter } from "@system/infrastructure/adapters/records/finalize-preserved-record-persistence.adapter"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { drizzle } from "drizzle-orm/d1"
import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { PreservedRecordRepository } from "@system/infrastructure/repositories/records/preserved-record.repository"
import { PreservedRecordDisclosurePolicyRepository } from "@system/infrastructure/repositories/records/preserved-record-disclosure-policy.repository"
import { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"
import { wrapSystemD1TestDatabase } from "@system/test/wrap-system-d1-test-database.test-support"

const now = new Date(Date.now() - 60000).toISOString()

function audit(
  snapshot: { id: string; auditEventId: string; actorAccountId: string },
  action: string,
  targetType: string,
) {
  const entity = SystemAuditEventEntity.restore({
    eventId: snapshot.auditEventId,
    actorAccountId: snapshot.actorAccountId,
    action,
    targetType,
    targetId: snapshot.id,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: JSON.stringify(snapshot),
    metadataJson: null,
    occurredAtEpochMilliseconds: Date.parse(now),
  })
  if (entity instanceof Error) throw entity
  return entity
}

function fixture(existing: Database | null = null) {
  const sqlite = existing ?? new Database(":memory:")
  if (existing === null) {
    sqlite.exec("PRAGMA foreign_keys = ON")
    for (const name of ["system-core", "system-attachment", "system-record-preservation"]) {
      sqlite.exec(
        readFileSync(new URL(`../infrastructure/schema/${name}.sql`, import.meta.url), "utf8"),
      )
    }
    sqlite.exec(
      "CREATE TABLE test_source_revision (revision INTEGER); INSERT INTO test_source_revision VALUES (1)",
    )
  }
  const db = wrapSystemD1TestDatabase(sqlite)
  const context = {
    env: { DB: db },
    assertions: [
      db.prepare(
        "SELECT CASE WHEN (SELECT revision FROM test_source_revision) = 1 THEN 1 ELSE json_extract('', '$') END",
      ),
    ],
  }
  const record = PreservedRecordEntity.create({
    id: crypto.randomUUID(),
    attachmentId: crypto.randomUUID(),
    attachmentDigest: "b".repeat(64),
    preservationId: crypto.randomUUID(),
    disclosurePolicyId: crypto.randomUUID(),
    disclosurePolicyRevision: 1,
    source: {
      sourceNamespace: "sample-source",
      ownerContext: "sample-records",
      recordKind: "record",
      recordId: "original-1",
      formatId: "sample-v1",
      formatVersion: 1,
      sourceRevision: null,
      sourceRecordedAt: null,
      capturedAt: now,
      contentDigest: "a".repeat(64),
    },
    sourceAuthorizationRef: {
      context: "sample-records",
      kind: "export-grant",
      id: "grant-1",
      version: "1",
    },
    actorAccountId: "operator",
    finalizedAt: now,
    reason: "Preserve original",
    auditEventId: crypto.randomUUID(),
  })
  if (record instanceof Error) throw record
  const value = record.snapshot
  const hold = AttachmentPreservationEntity.create({
    id: value.preservationId,
    attachmentId: value.attachmentId,
    sha256: value.attachmentDigest,
    kind: "hold",
    retainUntil: null,
    reason: value.reason,
    actorAccountId: value.actorAccountId,
    createdAt: now,
    auditEventId: crypto.randomUUID(),
    revision: 1,
    release: null,
  })
  if (hold instanceof Error) throw hold
  const policy = PreservedRecordDisclosurePolicyEntity.create({
    id: value.disclosurePolicyId,
    revision: 1,
    recordId: value.id,
    status: "active",
    publishedAt: now,
    actorAccountId: value.actorAccountId,
    reason: value.reason,
    auditEventId: crypto.randomUUID(),
    grants: [],
  })
  if (policy instanceof Error) throw policy
  sqlite
    .query(`INSERT INTO system_attachments (id, owner_account_id, object_key, status, content_type, byte_size, file_name,
    plaintext_sha256, wrapped_dek, wrapped_dek_iv, content_iv, kek_version, created_at)
    VALUES (?, ?, ?, 'pending', 'application/vnd.record-preservation+json', 10, 'preserved-record.json', ?, 'key', 'iv', 'iv', 1, ?)`)
    .run(
      value.attachmentId,
      value.actorAccountId,
      `att/${value.attachmentId}`,
      value.attachmentDigest,
      Date.parse(now),
    )
  const repository = new PreservedRecordRepository(context)
  const policyStatements = new PreservedRecordDisclosurePolicyRepository(context).preparePublish(
    policy,
    audit(
      policy.snapshot,
      "system.record.disclosure_policy.published",
      "system:record-disclosure-policy",
    ),
  )
  const holdStatements = new AttachmentPreservationRepository(context).prepareWrite(
    hold,
    audit(
      hold.snapshot,
      "system.attachment.preservation.created",
      "system:attachment-preservation",
    ),
  )
  const finalizeStatements = repository.prepareFinalize(
    record,
    audit(value, "system.record.preserved", "system:preserved-record"),
    {
      id: value.attachmentId,
      ownerAccountId: value.actorAccountId,
      objectKey: `att/${value.attachmentId}`,
      status: "pending",
      contentType: "application/vnd.record-preservation+json",
      byteSize: 10,
      fileName: "preserved-record.json",
      plaintextSha256: value.attachmentDigest,
      wrappedDek: "key",
      wrappedDekIv: "iv",
      contentIv: "iv",
      kekVersion: 1,
      createdAt: new Date(now),
      linkedAt: null,
      erasedAt: null,
    },
  )
  return {
    sqlite,
    db,
    record,
    policy,
    hold,
    repository,
    policyStatements,
    holdStatements,
    finalizeStatements,
  }
}

test("record, attachment link, hold, disclosure and audits commit together or all roll back", async () => {
  const f = fixture()
  try {
    const statements = [...f.policyStatements, ...f.holdStatements, ...f.finalizeStatements]
    expect(
      await f.db
        .batch([...statements, f.db.prepare("SELECT json_extract('', '$')")])
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
    for (const table of [
      "system_preserved_records",
      "system_record_disclosure_policies",
      "system_attachment_preservations",
      "system_audit_events",
    ])
      expect(f.sqlite.query(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({ count: 0 })
    expect(f.sqlite.query("SELECT status FROM system_attachments").get()).toEqual({
      status: "pending",
    })
    await f.db.batch(statements)
    const stored = await f.repository.find(f.record.snapshot.id)
    if (stored instanceof Error || stored === null) throw new Error("record missing")
    expect(stored.snapshot).toEqual(f.record.snapshot)
    expect(f.sqlite.query("SELECT count(*) AS count FROM system_audit_events").get()).toEqual({
      count: 3,
    })
    expect(() =>
      f.sqlite.exec("UPDATE system_preserved_records SET snapshot_json = '{}' "),
    ).toThrow()
    expect(() => f.sqlite.exec("DELETE FROM system_preserved_records")).toThrow()
    expect(await f.db.batch(statements).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
    expect(f.sqlite.query("SELECT count(*) AS count FROM system_audit_events").get()).toEqual({
      count: 3,
    })
  } finally {
    f.sqlite.close()
  }
})

test("missing hold or disclosure cannot leave an attachment linked or a successful audit", async () => {
  for (const missing of ["hold", "policy"]) {
    const f = fixture()
    try {
      const dependencies = missing === "hold" ? f.policyStatements : f.holdStatements
      expect(
        await f.db
          .batch([...dependencies, ...f.finalizeStatements])
          .catch((cause: unknown) => cause),
      ).toBeInstanceOf(Error)
      expect(f.sqlite.query("SELECT status FROM system_attachments").get()).toEqual({
        status: "pending",
      })
      expect(f.sqlite.query("SELECT count(*) AS count FROM system_audit_events").get()).toEqual({
        count: 0,
      })
    } finally {
      f.sqlite.close()
    }
  }
})

test("finalization rejects changed source and another attachment owner after preparation", async () => {
  for (const change of [
    "UPDATE test_source_revision SET revision = 2",
    "UPDATE system_attachments SET owner_account_id = 'other'",
  ]) {
    const f = fixture()
    try {
      f.sqlite.exec(change)
      expect(
        await f.db
          .batch([...f.policyStatements, ...f.holdStatements, ...f.finalizeStatements])
          .catch((cause: unknown) => cause),
      ).toBeInstanceOf(Error)
      expect(
        f.sqlite.query("SELECT count(*) AS count FROM system_preserved_records").get(),
      ).toEqual({ count: 0 })
      expect(f.sqlite.query("SELECT count(*) AS count FROM system_audit_events").get()).toEqual({
        count: 0,
      })
      expect(f.sqlite.query("SELECT status FROM system_attachments").get()).toEqual({
        status: "pending",
      })
    } finally {
      f.sqlite.close()
    }
  }
})

test("finalization rejects payload metadata changed after verification", async () => {
  for (const change of [
    "UPDATE system_attachments SET object_key = 'att/replaced'",
    "UPDATE system_attachments SET wrapped_dek = 'different-key'",
    "UPDATE system_attachments SET wrapped_dek_iv = 'different-iv'",
    "UPDATE system_attachments SET content_iv = 'different-iv'",
    "UPDATE system_attachments SET kek_version = 2",
    "UPDATE system_attachments SET byte_size = 11",
    "UPDATE system_attachments SET file_name = 'different.json'",
    "UPDATE system_attachments SET created_at = created_at - 1",
  ]) {
    const f = fixture()
    try {
      f.sqlite.exec(change)
      expect(
        await f.db
          .batch([...f.policyStatements, ...f.holdStatements, ...f.finalizeStatements])
          .catch((cause: unknown) => cause),
      ).toBeInstanceOf(Error)
      expect(
        f.sqlite.query("SELECT count(*) AS count FROM system_preserved_records").get(),
      ).toEqual({ count: 0 })
      expect(f.sqlite.query("SELECT count(*) AS count FROM system_audit_events").get()).toEqual({
        count: 0,
      })
      expect(f.sqlite.query("SELECT status FROM system_attachments").get()).toEqual({
        status: "pending",
      })
    } finally {
      f.sqlite.close()
    }
  }
})

test("approved record execution binds intent and actor and atomically consumes authorization", async () => {
  for (const scenario of [
    "allowed",
    "digest",
    "actor",
    "operation",
    "subject",
    "source",
    "qualification",
    "expired",
    "expired-before-commit",
  ]) {
    const f = fixture()
    try {
      f.sqlite.exec(
        readFileSync(
          new URL("../infrastructure/schema/system-workflow.sql", import.meta.url),
          "utf8",
        ),
      )
      f.sqlite.run(
        "INSERT INTO system_accounts (id,status,created_at,updated_at) VALUES ('operator','active',0,0)",
      )
      const command = { record: f.record, disclosure: f.policy, preservation: f.hold }
      const proposal = await RecordPreservationProposalValue.create(command)
      if (proposal instanceof Error) throw proposal
      const digest = proposal.props.digest.toString()
      f.sqlite.run(
        `INSERT INTO system_cases
        (id,subject_context,subject_kind,subject_id,subject_version,proposal_digest,created_by_account_id,status,created_at,updated_at)
        VALUES ('case-1','system','record-preservation',?1,'1',?2,'operator','approved',0,0)`,
        [scenario === "subject" ? "other-record" : f.record.snapshot.id, digest],
      )
      const authorization = ExecutionAuthorizationEntity.create({
        id: crypto.randomUUID(),
        caseId: "case-1",
        operationKey: scenario === "operation" ? "other-operation" : "system.record.preserve",
        proposalDigest: scenario === "digest" ? "c".repeat(64) : digest,
        grantedToAccountId: scenario === "actor" ? "other-operator" : "operator",
        grantedAt: new Date(Date.parse(now) - 1000),
        expiresAt: new Date(
          Date.parse(now) +
            (scenario === "expired" ? 0 : scenario === "expired-before-commit" ? 1000 : 3600000),
        ),
        usedAt: null,
      })
      if (authorization instanceof Error) throw authorization
      const attachment = await new AttachmentAdapter({ var: { database: drizzle(f.db) } }).findById(
        f.record.snapshot.attachmentId,
      )
      if (attachment === null || attachment instanceof Error) throw new Error("missing attachment")
      const adapter = new FinalizePreservedRecordPersistenceAdapter({
        env: { DB: f.db },
        authorization,
        executionGuards: [
          f.db.prepare(scenario === "qualification" ? "SELECT json_extract('', '$')" : "SELECT 1"),
        ],
        assertions: [
          f.db.prepare(
            "SELECT CASE WHEN (SELECT revision FROM test_source_revision) = 1 THEN 1 ELSE json_extract('', '$') END",
          ),
        ],
      })
      if (scenario === "source") f.sqlite.exec("UPDATE test_source_revision SET revision = 2")
      const input = {
        command,
        authorization,
        attachment,
        recordAudit: audit(f.record.snapshot, "system.record.preserved", "system:preserved-record"),
        policyAudit: audit(
          f.policy.snapshot,
          "system.record.disclosure_policy.published",
          "system:record-disclosure-policy",
        ),
        holdAudit: audit(
          f.hold.snapshot,
          "system.attachment.preservation.created",
          "system:attachment-preservation",
        ),
      }
      const execute = () => adapter.executeAuthorized(input)
      const result = await execute()
      if (scenario === "allowed") {
        expect(result).toBe(true)
        expect(await execute()).toBeInstanceOf(Error)
        expect(await adapter.find(command)).toEqual(f.record)
        const otherAuthorization = ExecutionAuthorizationEntity.create({
          id: crypto.randomUUID(),
          caseId: authorization.caseId,
          operationKey: authorization.operationKey,
          proposalDigest: authorization.proposalDigest,
          grantedToAccountId: authorization.grantedToAccountId,
          grantedAt: authorization.grantedAt,
          expiresAt: authorization.expiresAt,
          usedAt: null,
        })
        if (otherAuthorization instanceof Error) throw otherAuthorization
        const replayWithOtherAuthorization = new FinalizePreservedRecordPersistenceAdapter({
          env: { DB: f.db },
          authorization: otherAuthorization,
          assertions: [f.db.prepare("SELECT 1")],
          executionGuards: [f.db.prepare("SELECT 1")],
        })
        expect(await replayWithOtherAuthorization.find(command)).toBeInstanceOf(Error)
      } else expect(result).toBeInstanceOf(Error)
      const expected = Number(scenario === "allowed")
      for (const table of [
        "system_preserved_records",
        "system_execution_authorizations",
        "system_attachment_preservations",
        "system_record_disclosure_policies",
      ])
        expect(f.sqlite.query(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({
          count: expected,
        })
      expect(f.sqlite.query("SELECT status FROM system_cases").get()).toEqual({
        status: expected ? "executed" : "approved",
      })
      expect(f.sqlite.query("SELECT status FROM system_attachments").get()).toEqual({
        status: expected ? "linked" : "pending",
      })
      expect(f.sqlite.query("SELECT count(*) AS count FROM system_audit_events").get()).toEqual({
        count: expected * 3,
      })
    } finally {
      f.sqlite.close()
    }
  }
})

const searchInput = {
  action: "read",
  purpose: "company-retention",
  sourceNamespace: null,
  ownerContext: null,
  recordKind: null,
  sourceRecordId: null,
  after: null,
  limit: 1,
}

async function publishSearchGrant(
  f: ReturnType<typeof fixture>,
  grants: PreservedRecordDisclosurePolicyEntity["snapshot"]["grants"],
  revision = 2,
) {
  const policy = PreservedRecordDisclosurePolicyEntity.create({
    ...f.policy.snapshot,
    revision,
    auditEventId: crypto.randomUUID(),
    grants,
  })
  if (policy instanceof Error) throw policy
  await f.db.batch([
    ...new PreservedRecordDisclosurePolicyRepository({
      env: { DB: f.db },
      assertions: [],
    }).preparePublish(
      policy,
      audit(
        policy.snapshot,
        "system.record.disclosure_policy.published",
        "system:record-disclosure-policy",
      ),
    ),
  ])
}

function searchService(f: ReturnType<typeof fixture>, clock = () => new Date(now)) {
  return new DisclosePreservedRecordIndex({
    accountId: "reader",
    now: clock,
    persistence: new DisclosePreservedRecordIndexPersistenceAdapter({
      env: { DB: f.db },
      authorizationAssertions: () => [
        f.db.prepare(
          "SELECT CASE WHEN (SELECT revision FROM test_source_revision) = 1 THEN 1 ELSE json_extract('', '$') END",
        ),
      ],
    }),
  })
}

const searchGrant = {
  accountId: "reader",
  actions: ["read" as const],
  purposes: ["company-retention"],
  validFrom: now,
  validUntil: null,
}

test("Systemだけで保全物を探し、未許可の記録をcursorや件数へ混ぜない", async () => {
  const f = fixture()
  try {
    const others = [fixture(f.sqlite), fixture(f.sqlite)]
    for (const item of [f, ...others]) {
      await item.db.batch([
        ...item.policyStatements,
        ...item.holdStatements,
        ...item.finalizeStatements,
      ])
    }
    for (const item of others) await publishSearchGrant(item, [searchGrant])
    const service = searchService(f)
    const first = await service.execute(searchInput)
    if (first instanceof Error) throw first
    const ids = others.map((item) => item.record.snapshot.id).sort()
    expect(first.records.map((record) => record.recordId)).toEqual(ids.slice(0, 1))
    expect(first.nextCursor).toBe(ids[0])
    expect(first.records[0]?.source.sourceRevision).toBeNull()
    expect(first.records[0]?.source.sourceRecordedAt).toBeNull()
    expect(JSON.stringify(first)).not.toContain(f.record.snapshot.id)
    expect(first).not.toHaveProperty("total")
    const second = await service.execute({ ...searchInput, after: first.nextCursor })
    if (second instanceof Error) throw second
    expect(second.records.map((record) => record.recordId)).toEqual(ids.slice(1))
    expect(second.nextCursor).toBeNull()
    for (const filter of [
      { action: "export" },
      { purpose: "other-purpose" },
      { sourceNamespace: "another-source" },
      { ownerContext: "another-context" },
      { recordKind: "another-kind" },
      { sourceRecordId: "another-record" },
    ]) {
      expect(await service.execute({ ...searchInput, ...filter })).toEqual({
        records: [],
        nextCursor: null,
      })
    }
    expect(
      f.sqlite
        .query(
          "SELECT count(*) AS count FROM system_audit_events WHERE action = 'system.record.searched'",
        )
        .get(),
    ).toEqual({ count: 8 })
  } finally {
    f.sqlite.close()
  }
})

test("期限到来・資格変更・監査失敗では保全物の一覧を返さない", async () => {
  for (const failure of ["expiry", "authority", "audit", "policy"]) {
    const f = fixture()
    try {
      await f.db.batch([...f.policyStatements, ...f.holdStatements, ...f.finalizeStatements])
      await publishSearchGrant(f, [
        { ...searchGrant, validUntil: new Date(Date.parse(now) + 1000).toISOString() },
      ])
      const calls: Date[] = []
      const service = searchService(f, () => {
        calls.push(new Date(now))
        if (calls.length === 2) {
          if (failure === "expiry") return new Date(Date.parse(now) + 1000)
          if (failure === "authority") f.sqlite.exec("UPDATE test_source_revision SET revision = 2")
          if (failure === "audit")
            f.sqlite.exec(
              "CREATE TRIGGER reject_search_audit BEFORE INSERT ON system_audit_events WHEN NEW.action = 'system.record.searched' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
            )
          if (failure === "policy") {
            f.sqlite.exec("DROP TRIGGER system_record_disclosure_prevent_update")
            f.sqlite.exec(
              "UPDATE system_record_disclosure_policies SET snapshot_json = json_set(snapshot_json, '$.status', 'revoked') WHERE revision = 2",
            )
          }
        }
        return new Date(now)
      })
      expect(await service.execute(searchInput)).toBeInstanceOf(Error)
      expect(
        f.sqlite
          .query(
            "SELECT count(*) AS count FROM system_audit_events WHERE action = 'system.record.searched'",
          )
          .get(),
      ).toEqual({ count: 0 })
    } finally {
      f.sqlite.close()
    }
  }
})

test("期限外の候補が一取得分を超えても許可済み記録まで走査し、元版を推測しない", async () => {
  const f = fixture()
  try {
    const fixtures = [f, ...Array.from({ length: 52 }, () => fixture(f.sqlite))]
    fixtures.sort((left, right) => left.record.snapshot.id.localeCompare(right.record.snapshot.id))
    const allowed = fixtures.slice(-2)
    for (const item of fixtures) {
      await item.db.batch([
        ...item.policyStatements,
        ...item.holdStatements,
        ...item.finalizeStatements,
      ])
      const grants = allowed.includes(item)
        ? [searchGrant]
        : [
            {
              ...searchGrant,
              validFrom: new Date(Date.parse(now) - 1000).toISOString(),
              validUntil: now,
            },
          ]
      await publishSearchGrant(item, grants)
    }
    const service = searchService(f)
    const first = await service.execute({ ...searchInput, sourceRecordId: "original-1" })
    if (first instanceof Error) throw first
    expect(first.records.map((record) => record.recordId)).toEqual([allowed[0]?.record.snapshot.id])
    expect(first.nextCursor).toBe(allowed[0]?.record.snapshot.id)
    const second = await service.execute({ ...searchInput, after: first.nextCursor })
    if (second instanceof Error) throw second
    expect(second.records.map((record) => record.recordId)).toEqual([
      allowed[1]?.record.snapshot.id,
    ])
    expect(second.nextCursor).toBeNull()
    expect(second.records[0]?.source.sourceRevision).toBeNull()
    expect(second.records[0]?.source.sourceRecordedAt).toBeNull()
    expect(await service.execute({ ...searchInput, limit: 51 })).toBeInstanceOf(Error)
    expect(
      await new DisclosePreservedRecordIndex({
        accountId: "reader",
        now: () => new Date(now),
        persistence: new DisclosePreservedRecordIndexPersistenceAdapter({
          env: { DB: f.db },
          authorizationAssertions: () => [],
        }),
      }).execute(searchInput),
    ).toBeInstanceOf(Error)
  } finally {
    f.sqlite.close()
  }
})

test("過去のcursorで開示設定の最新版を迂回せず、将来の許可を先取りしない", async () => {
  const f = fixture()
  try {
    const records = [f, fixture(f.sqlite)].sort((left, right) =>
      left.record.snapshot.id.localeCompare(right.record.snapshot.id),
    )
    for (const item of records) {
      await item.db.batch([
        ...item.policyStatements,
        ...item.holdStatements,
        ...item.finalizeStatements,
      ])
      await publishSearchGrant(item, [searchGrant])
    }
    const page = await searchService(f).execute(searchInput)
    if (page instanceof Error) throw page
    const later = records[1]
    if (later === undefined || page.nextCursor === null) throw new Error("second page missing")
    await publishSearchGrant(later, [], 3)
    expect(await searchService(f).execute({ ...searchInput, after: page.nextCursor })).toEqual({
      records: [],
      nextCursor: null,
    })
    await publishSearchGrant(
      later,
      [{ ...searchGrant, validFrom: new Date(Date.parse(now) + 60000).toISOString() }],
      4,
    )
    expect(await searchService(f).execute({ ...searchInput, after: page.nextCursor })).toEqual({
      records: [],
      nextCursor: null,
    })
    const effective = await searchService(f, () => new Date(Date.parse(now) + 60000)).execute({
      ...searchInput,
      after: page.nextCursor,
    })
    if (effective instanceof Error) throw effective
    expect(effective.records.map((record) => record.recordId)).toEqual([later.record.snapshot.id])
    expect(effective.nextCursor).toBeNull()
  } finally {
    f.sqlite.close()
  }
})
