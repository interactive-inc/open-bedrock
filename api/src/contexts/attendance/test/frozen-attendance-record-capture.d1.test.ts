import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createAttendanceRecordSourceFixture } from "@/contexts/attendance/test/create-attendance-record-source-fixture.test-support"
import { CaptureFrozenAttendanceRecordPageAdapter } from "@/contexts/attendance/infrastructure/adapters/capture-frozen-attendance-record-page.adapter"
import { PreservedRecordContentValue } from "@system/domain/values/records/preserved-record-content.value"
import { CreateRecordSourceFreeze } from "@system/application/records/create-record-source-freeze"
import { ReleaseRecordSourceFreeze } from "@system/application/records/release-record-source-freeze"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import { execSql } from "@tests/d1/support/exec-sql"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["frozen-capture"],
  })
})

afterAll(async () => {
  await local.dispose()
})

test("停止世代から原文・来歴・digestを取得し、解除後にページ確定を拒否する", async () => {
  const f = await createAttendanceRecordSourceFixture(await local.database("frozen-capture"))
  const repository = openSystemRecordSourceFreezes({ env: f.context.env, assertions: [] })
  const command = {
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "attendance",
    actorAccountId: f.authentication.accountId,
    reason: "Preserve all content",
  }
  await new CreateRecordSourceFreeze({ repository }).execute(command, f.clock.now)
  const adapter = new CaptureFrozenAttendanceRecordPageAdapter(f.context)
  const input = {
    freezeId: command.id,
    sourceNamespace: command.sourceNamespace,
    afterId: 0,
    limit: 1,
  }
  const first = await adapter.prepare(input)
  if (first instanceof Error) throw first
  expect(first.records).toHaveLength(1)
  expect(first.nextAfterId).toBe(1)
  const last = await adapter.prepare({ ...input, afterId: 1 })
  if (last instanceof Error) throw last
  expect(last.nextAfterId).toBeNull()
  const contents = [...first.records, ...last.records]
  for (const record of contents) {
    expect(
      await PreservedRecordContentValue.create(record.source, record.content),
    ).not.toBeInstanceOf(Error)
    const raw = await f.database
      .prepare("SELECT * FROM attendance_records WHERE id=?1")
      .bind(Number(record.source.props.recordId))
      .first()
    expect(JSON.parse(new TextDecoder().decode(record.content))).toEqual({
      format: "attendance-record",
      version: 2,
      record: raw,
    })
    expect(record.source.props.sourceRevision).toBeNull()
    expect(record.source.props.sourceRecordedAt).toBeNull()
  }
  expect(await adapter.prepare({ ...input, limit: 11 })).toBeInstanceOf(Error)
  await f.database.batch([...first.assertions])
  await new ReleaseRecordSourceFreeze({ repository }).execute(command, f.clock.now)
  await execSql(f.database, "UPDATE attendance_records SET note='New source' WHERE id=1")
  expect(await adapter.prepare(input)).toBeInstanceOf(Error)
  expect(
    await f.database
      .batch([
        f.database.prepare("INSERT INTO capture_test_receipts VALUES ('stale-body')"),
        ...first.assertions,
      ])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await f.database.prepare("SELECT count(*) AS n FROM capture_test_receipts").first<number>("n"),
  ).toBe(0)
})
