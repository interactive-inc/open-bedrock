import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0334_convert_governance_knowledge_keys_to_uuid.sql"
const DOCUMENT = "3f0c8c1e-6d2a-4b7e-9a51-0c2d4e6f8a10"
const VERSION = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"

function seed(database: Database) {
  database.run("PRAGMA foreign_keys = OFF")
  database.run(
    `INSERT INTO governance_documents (id, code, title, kind, classification, owner_capability_code, status, current_version_id, source_path, created_by_account_id, created_at, updated_at)
     VALUES ('${DOCUMENT}', 'DOC-1', 'Doc', 'policy', 'internal', 'policy-management', 'published', '${VERSION}', 'docs/doc-1.md', 'account', '2026-01-01', '2026-01-01')`,
  )
  database.run(
    `INSERT INTO governance_document_versions (id, document_id, version, body_md, metadata_json, content_hash, state, created_by_account_id, created_at)
     VALUES ('${VERSION}', '${DOCUMENT}', '1.0.0', 'body', '{}', 'hash', 'published', 'account', '2026-01-01')`,
  )
  database.run(
    `INSERT INTO governance_acknowledgements (version_id, employee_id, content_hash, acknowledged_at)
     VALUES ('${VERSION}', 'E005', 'hash', '2026-01-02')`,
  )
  database.run(
    `INSERT INTO governance_org_role_assignments (id, org_role_code, employee_id, starts_on, created_by_account_id, created_at)
     VALUES (3, 'ciso', 'E004', '2026-01-05', 'account', '2026-01-05')`,
  )
  database.run(
    `INSERT INTO knowledge_articles (id, title, category, body_md, author_id, created_at)
     VALUES (9, 'Title', 'cat', 'body', 'E002', '2026-01-05')`,
  )
  insertBypassingGuards(
    database,
    "knowledge_article_revisions",
    `INSERT INTO knowledge_article_revisions (article_id, revision, snapshot_json, status, source, reason, recorded_at)
     VALUES (9, 1, '{"id":9}', 'active', 'existing_record', 'initial', 0)`,
  )
}

test("規程とナレッジの主キーを UUID にし、参照を追従させ、版の履歴本文は書き換えない", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const capabilitiesBefore = database
      .query<{ code: string }, []>("SELECT code FROM governance_capabilities ORDER BY code")
      .all()

    applyMigration(database, TARGET)

    expect(database.query("SELECT id, current_version_id FROM governance_documents").get()).toEqual(
      { id: DOCUMENT, current_version_id: VERSION },
    )
    expect(database.query("SELECT version_id FROM governance_acknowledgements").get()).toEqual({
      version_id: VERSION,
    })
    const capabilities = database
      .query<{ id: string; code: string }, []>(
        "SELECT id, code FROM governance_capabilities ORDER BY code",
      )
      .all()
    expect(capabilities.map((row) => ({ code: row.code }))).toEqual(capabilitiesBefore)
    expect(capabilities.every((row) => isUuid(row.id))).toBe(true)
    expect(
      database
        .query<{ id: string; legacy_id: string }, []>(
          "SELECT id, legacy_id FROM governance_org_role_assignments",
        )
        .all()
        .map((row) => ({ uuid: isUuid(row.id), legacy_id: row.legacy_id })),
    ).toEqual([{ uuid: true, legacy_id: "3" }])
    const article = database
      .query<{ id: string }, []>("SELECT id FROM knowledge_articles WHERE legacy_id = '9'")
      .get()?.id
    expect(isUuid(article)).toBe(true)
    expect(
      database
        .query("SELECT article_id, revision, snapshot_json FROM knowledge_article_revisions")
        .get(),
    ).toEqual({ article_id: article, revision: 1, snapshot_json: '{"id":9}' })
    expect(() => database.run("UPDATE knowledge_article_revisions SET reason = 'x'")).toThrow(
      "knowledge_revision_immutable",
    )
    expect(() =>
      database.run(
        `INSERT INTO governance_org_roles (id, code, name, created_at, updated_at)
         VALUES ('${crypto.randomUUID()}', 'ciso', 'dup', '2026-01-01', '2026-01-01')`,
      ),
    ).toThrow("UNIQUE constraint failed")
    expect(database.query("PRAGMA foreign_key_check").all()).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ table: "knowledge_article_revisions" }),
      ]),
    )
    expect(
      database
        .query(
          "SELECT name FROM sqlite_master WHERE name LIKE '\\_%' ESCAPE '\\' OR name LIKE '\\_\\_new\\_%' ESCAPE '\\'",
        )
        .all(),
    ).toEqual([])
  } finally {
    database.close()
  }
})

test("置き換える規程の ID が監査の証跡に現れれば止める", () => {
  const database = databaseBefore(TARGET)
  try {
    const legacyDocument = "00000000-0000-0000-0000-000000000009"
    database.run("PRAGMA foreign_keys = OFF")
    database.run(
      `INSERT INTO governance_documents (id, code, title, kind, classification, owner_capability_code, status, source_path, created_by_account_id, created_at, updated_at)
       VALUES ('${legacyDocument}', 'DOC-9', 'Doc', 'policy', 'internal', 'policy-management', 'draft', 'docs/doc-9.md', 'account', '2026-01-01', '2026-01-01')`,
    )
    insertBypassingGuards(
      database,
      "system_audit_events",
      `INSERT INTO system_audit_events (event_id, action, target_type, target_id, outcome, occurred_at)
       VALUES ('${crypto.randomUUID()}', 'governance.document.published', 'governance_document', '${legacyDocument}', 'success', 0)`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
