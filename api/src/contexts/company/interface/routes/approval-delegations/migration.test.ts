import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

describe("approval delegation timestamp migration", () => {
  test("canonicalizes legacy offsets and cancels unparseable active rows", async () => {
    const db = createD1TestDatabase(`
      CREATE TABLE approval_delegations (
        id INTEGER PRIMARY KEY,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        cancelled_at TEXT
      );
      INSERT INTO approval_delegations VALUES
        (1, '2026-07-14T09:00:00+09:00', '2026-07-14T10:00:00+09:00',
         '2026-07-01T00:00:00.000Z', NULL),
        (2, 'not-a-date', '2026-07-14T10:00:00+09:00',
         '2026-07-02T00:00:00.000Z', NULL),
        (3, '2026-07-14T00:00:00.000Z', '2026-07-14T01:00:00.000Z',
         '2026-07-03T00:00:00.000Z', NULL);
    `)
    const migration = readFileSync(
      join(import.meta.dir, "../../../../migrations/0013_canonicalize_delegation_times.sql"),
      "utf8",
    )

    await db.exec(migration)

    const rows = await db
      .prepare(
        `SELECT id, starts_at, ends_at, cancelled_at
         FROM approval_delegations ORDER BY id`,
      )
      .all<{
        id: number
        starts_at: string
        ends_at: string
        cancelled_at: string | null
      }>()

    expect(rows.results).toEqual([
      {
        id: 1,
        starts_at: "2026-07-14T00:00:00.000Z",
        ends_at: "2026-07-14T01:00:00.000Z",
        cancelled_at: null,
      },
      {
        id: 2,
        starts_at: "not-a-date",
        ends_at: "2026-07-14T10:00:00+09:00",
        cancelled_at: "2026-07-02T00:00:00.000Z",
      },
      {
        id: 3,
        starts_at: "2026-07-14T00:00:00.000Z",
        ends_at: "2026-07-14T01:00:00.000Z",
        cancelled_at: null,
      },
    ])
  })
})
