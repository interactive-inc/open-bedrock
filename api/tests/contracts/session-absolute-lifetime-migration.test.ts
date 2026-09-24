import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const migration = readFileSync(
  join(import.meta.dir, "../../migrations/0327_session_absolute_lifetime.sql"),
  "utf8",
)

/** 列追加前のsystem_sessionsと旧triggerだけを持つ最小fixture。 */
function fixture() {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE system_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      family_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      token_version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
      rotated_at INTEGER,
      revoked_at INTEGER
    );
    CREATE TRIGGER system_sessions_monotonic_lifecycle
    BEFORE UPDATE ON system_sessions
    WHEN NEW.created_at IS NOT OLD.created_at
    BEGIN
      SELECT RAISE(ABORT, 'session lifecycle is not monotonic');
    END;
    INSERT INTO system_sessions VALUES
      ('a-1', 'account', 'family-a', 'hash-a-1', 0, 100, 1000, 200, NULL),
      ('a-2', 'account', 'family-a', 'hash-a-2', 0, 200, 1100, NULL, NULL),
      ('b-1', 'account', 'family-b', 'hash-b-1', 0, 500, 1500, NULL, 600);
  `)
  return database
}

test("既存行の認証時刻をfamilyで最も早い作成時刻でbackfillする", () => {
  const database = fixture()
  database.exec(migration)

  expect(
    database.query("SELECT id, authenticated_at FROM system_sessions ORDER BY id").all(),
  ).toEqual([
    { id: "a-1", authenticated_at: 100 },
    { id: "a-2", authenticated_at: 100 },
    { id: "b-1", authenticated_at: 500 },
  ])
})

test("backfill後の認証時刻は変更できず、作成時刻より後の値は保存できない", () => {
  const database = fixture()
  database.exec(migration)

  expect(() =>
    database.exec("UPDATE system_sessions SET authenticated_at = 50 WHERE id = 'a-2'"),
  ).toThrow("session lifecycle is not monotonic")
  expect(() =>
    database.exec(`INSERT INTO system_sessions
      (id, account_id, family_id, token_hash, token_version, created_at, expires_at, authenticated_at)
      VALUES ('c-1', 'account', 'family-c', 'hash-c-1', 0, 100, 200, 150)`),
  ).toThrow()
  database.exec(`INSERT INTO system_sessions
    (id, account_id, family_id, token_hash, token_version, created_at, expires_at, authenticated_at)
    VALUES ('c-2', 'account', 'family-c', 'hash-c-2', 0, 100, 200, 100)`)
  expect(() =>
    database.exec("UPDATE system_sessions SET revoked_at = 150 WHERE id = 'c-2'"),
  ).not.toThrow()
})
