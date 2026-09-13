import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
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

function fixture() {
  const sqlite = new Database(":memory:")
  sqlite.exec("PRAGMA foreign_keys = ON")
  for (const name of ["system-core", "system-attachment", "system-record-preservation"]) {
    sqlite.exec(
      readFileSync(new URL(`../infrastructure/schema/${name}.sql`, import.meta.url), "utf8"),
    )
  }
  sqlite.exec(
    "CREATE TABLE test_source_revision (revision INTEGER); INSERT INTO test_source_revision VALUES (1)",
  )
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
