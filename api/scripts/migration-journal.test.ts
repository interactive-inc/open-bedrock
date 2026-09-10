import { describe, expect, test } from "bun:test"
import { MigrationJournal } from "./migration-journal"

describe("remote migration identities", () => {
  test("accepts a fresh database and later pending files with gaps", () => {
    expect(MigrationJournal.inspect({ appliedNames: [], localNames: ["0001_init.sql"] })).toEqual(
      [],
    )
    expect(
      MigrationJournal.inspect({
        appliedNames: ["0001_init.sql"],
        localNames: ["0001_init.sql", "0005_next.sql"],
      }),
    ).toEqual([])
  })
  test("rejects renamed applied files", () => {
    expect(
      MigrationJournal.inspect({ appliedNames: ["0001_old.sql"], localNames: ["0001_new.sql"] }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("missing locally"),
        expect.stringContaining("reused"),
      ]),
    )
  })
  test("rejects older pending DDL even when applied files are retained", () => {
    expect(
      MigrationJournal.inspect({
        appliedNames: ["0003_current.sql"],
        localNames: ["0002_late.sql", "0003_current.sql"],
      }),
    ).toContain("pending migration precedes applied history: 0002_late.sql")
  })
  test("normalizes leading zeroes when checking number collisions", () => {
    expect(
      MigrationJournal.inspect({
        appliedNames: ["0001_old.sql"],
        localNames: ["0001_old.sql", "1_new.sql"],
      }),
    ).toContain("migration number 1 is reused: 0001_old.sql, 1_new.sql")
  })
  test("rejects duplicate rows, unnumbered DDL and unsafe numbers", () => {
    expect(
      MigrationJournal.inspect({
        appliedNames: ["0001_init.sql", "0001_init.sql"],
        localNames: ["0001_init.sql", "pending.sql", "999999999999999999999_pending.sql"],
      }),
    ).toEqual(
      expect.arrayContaining([
        "duplicate migration filename",
        "invalid migration filename: pending.sql",
        "invalid migration filename: 999999999999999999999_pending.sql",
      ]),
    )
  })
})
