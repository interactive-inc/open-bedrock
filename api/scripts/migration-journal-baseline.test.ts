import { expect, test } from "bun:test"
import { MigrationJournalBaseline } from "./migration-journal-baseline"
import { MigrationJournal } from "./migration-journal"
const original = ["0001_archived.sql", "0002_archived.sql", "0001_current.sql"]
const props = {
  databaseId: "example-database",
  appliedNames: original,
  archivedNames: original.slice(0, 2),
  schemaSha256: "a".repeat(64),
  backupSha256: "b".repeat(64),
}
const input = {
  databaseId: props.databaseId,
  appliedNames: original,
  localNames: ["0001_current.sql", "0002_pending.sql"],
  schemaSha256: props.schemaSha256,
}
function baseline() {
  const value = MigrationJournalBaseline.create(props)
  if (value instanceof Error) throw value
  return value
}
test("確認済みの別世代だけを区別し、適用済み履歴を書き換えない", () => {
  const before = [...original]
  const appliedNames = baseline().inspect(input)
  if (appliedNames instanceof Error) throw appliedNames
  expect(MigrationJournal.inspect({ appliedNames, localNames: input.localNames })).toEqual([])
  expect(original).toEqual(before)
})
test("別DB、schema変化、履歴の消失・並べ替えは拒否する", () => {
  expect(baseline().inspect({ ...input, databaseId: "other-database" })).toBeInstanceOf(Error)
  expect(baseline().inspect({ ...input, schemaSha256: "c".repeat(64) })).toBeInstanceOf(Error)
  expect(baseline().inspect({ ...input, appliedNames: original.slice(1) })).toBeInstanceOf(Error)
  expect(baseline().inspect({ ...input, appliedNames: [...original].reverse() })).toBeInstanceOf(
    Error,
  )
})
test("後続の未知名と遅延追加を従来の検査に渡し、暗黙に許可しない", () => {
  const appliedNames = baseline().inspect({
    ...input,
    appliedNames: [...original, "0003_unknown.sql"],
  })
  if (appliedNames instanceof Error) throw appliedNames
  const failures = MigrationJournal.inspect({ appliedNames, localNames: input.localNames })
  expect(failures).toContain("applied migration is missing locally: 0003_unknown.sql")
  expect(failures).toContain("pending migration precedes applied history: 0002_pending.sql")
})
test("確認した履歴を実行対象へ戻すことを拒否する", () => {
  expect(
    baseline().inspect({ ...input, localNames: [...input.localNames, "0001_archived.sql"] }),
  ).toBeInstanceOf(Error)
})
test("架空の旧名、重複、バックアップ証拠の欠落を拒否する", () => {
  expect(
    MigrationJournalBaseline.create({ ...props, archivedNames: ["0009_unknown.sql"] }),
  ).toBeInstanceOf(Error)
  expect(
    MigrationJournalBaseline.create({ ...props, appliedNames: [...original, original[0]] }),
  ).toBeInstanceOf(Error)
  expect(MigrationJournalBaseline.create({ ...props, backupSha256: "" })).toBeInstanceOf(Error)
})

test("確認後に旧名が再追加された場合も重複を隠さない", () => {
  expect(
    baseline().inspect({ ...input, appliedNames: [...original, "0001_archived.sql"] }),
  ).toBeInstanceOf(Error)
})
