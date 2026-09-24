import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createAttendanceRecordSourceFixture } from "@/contexts/attendance/test/create-attendance-record-source-fixture.test-support"
import { RecordSourceFreezeEntity } from "@system/domain/entities/record-source-freeze.entity"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["prepared-update", "release-atomicity", "replace-insert"],
  })
})

afterAll(async () => {
  await local.dispose()
})

function freezeEntity() {
  const freeze = RecordSourceFreezeEntity.create({
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "attendance",
    actorAccountId: "account:recorder",
    reason: "Preserve the full source before retirement",
    createdAt: new Date().toISOString(),
    auditEventId: crypto.randomUUID(),
    revision: 1,
    release: null,
  })
  if (freeze instanceof Error) throw freeze
  return freeze
}

function auditStatement(
  db: D1Database,
  freeze: RecordSourceFreezeEntity,
  before: RecordSourceFreezeEntity | null,
) {
  const value = freeze.snapshot
  const release = value.release
  return db
    .prepare(`INSERT INTO system_audit_events
    (event_id,actor_account_id,action,target_type,target_id,outcome,authorization_json,before_json,after_json,occurred_at)
    VALUES (?1,?2,?3,'system:record-source-freeze',?4,'succeeded','{}',?5,?6,?7)`)
    .bind(
      release?.auditEventId ?? value.auditEventId,
      release?.actorAccountId ?? value.actorAccountId,
      release === null
        ? "system.record.source.freeze.created"
        : "system.record.source.freeze.released",
      value.id,
      before === null ? null : JSON.stringify(before.snapshot),
      JSON.stringify(value),
      Date.parse(release?.at ?? value.createdAt),
    )
}

function insertStatement(db: D1Database, freeze: RecordSourceFreezeEntity, replace = false) {
  const value = freeze.snapshot
  return db
    .prepare(`INSERT${replace ? " OR REPLACE" : ""} INTO system_record_source_freezes
    (id,source_namespace,owner_context,revision,created_audit_event_id,release_audit_event_id,snapshot_json)
    VALUES (?1,?2,?3,1,?4,NULL,?5)`)
    .bind(
      value.id,
      value.sourceNamespace,
      value.ownerContext,
      value.auditEventId,
      JSON.stringify(value),
    )
}

test("停止前に準備した打刻更新もDBで拒否し、取得・照合は停止中も続けられる", async () => {
  const f = await createAttendanceRecordSourceFixture(await local.database("prepared-update"))
  const queued = f.database.prepare("UPDATE attendance_records SET note='Queued update' WHERE id=1")
  const freeze = freezeEntity()
  expect(
    await insertStatement(f.database, freeze)
      .run()
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  await f.database.batch([
    auditStatement(f.database, freeze, null),
    insertStatement(f.database, freeze),
  ])
  for (const statement of [
    queued,
    f.database.prepare("DELETE FROM attendance_records WHERE id=1"),
    f.database.prepare(`INSERT INTO attendance_records (id,employee_id,work_date,clock_in_at,status)
      VALUES (3,'employee:worker','2026-09-03','2026-09-03T00:00:00Z','closed')`),
  ])
    expect(await statement.run().catch((error: unknown) => error)).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT note FROM attendance_records WHERE id=1")
      .first<string>("note"),
  ).toBe("Original note")
  const inventory = await f.inventory.prepare()
  if (inventory instanceof Error) throw inventory
  expect(inventory.recordIds).toEqual([1, 2])
  const captured = await f.capture.prepare(f.input)
  if (captured instanceof Error) throw captured
  await f.database.batch([...inventory.assertions, ...captured.assertions])
  expect(
    await f.database
      .prepare("DELETE FROM system_record_source_freezes WHERE id=?1")
      .bind(freeze.snapshot.id)
      .run()
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
})

test("解除は監査と原子的に確定し、再停止は別世代となり保存元名の変更でも二重停止しない", async () => {
  const f = await createAttendanceRecordSourceFixture(await local.database("release-atomicity"))
  const freeze = freezeEntity()
  await f.database.batch([
    auditStatement(f.database, freeze, null),
    insertStatement(f.database, freeze),
  ])
  const other = RecordSourceFreezeEntity.create({
    ...freezeEntity().snapshot,
    sourceNamespace: "other-source",
  })
  if (other instanceof Error) throw other
  expect(
    await f.database
      .batch([auditStatement(f.database, other, null), insertStatement(f.database, other)])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_audit_events WHERE event_id=?1")
      .bind(other.snapshot.auditEventId)
      .first<number>("n"),
  ).toBe(0)
  const released = freeze.release({
    actorAccountId: "account:recorder",
    reason: "Resume source writes",
    at: new Date().toISOString(),
    auditEventId: crypto.randomUUID(),
  })
  if (released instanceof Error || released.snapshot.release === null)
    throw new Error("invalid release fixture")
  const update = f.database
    .prepare(`UPDATE system_record_source_freezes SET revision=2,release_audit_event_id=?1,snapshot_json=?2
    WHERE id=?3 AND revision=1`)
    .bind(
      released.snapshot.release.auditEventId,
      JSON.stringify(released.snapshot),
      freeze.snapshot.id,
    )
  expect(await update.run().catch((error: unknown) => error)).toBeInstanceOf(Error)
  expect(
    await f.database
      .batch([
        auditStatement(f.database, released, freeze),
        update,
        f.database.prepare("SELECT json_extract('{}','invalid-path')"),
      ])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT revision FROM system_record_source_freezes WHERE id=?1")
      .bind(freeze.snapshot.id)
      .first<number>("revision"),
  ).toBe(1)
  await f.database.batch([auditStatement(f.database, released, freeze), update])
  await f.database
    .prepare("UPDATE attendance_records SET note='Updated after release' WHERE id=1")
    .run()
  const next = freezeEntity()
  await f.database.batch([
    auditStatement(f.database, next, null),
    insertStatement(f.database, next),
  ])
  expect(next.matchesActiveGeneration(freeze.snapshot)).toBe(false)
  expect(
    await f.database
      .prepare("UPDATE attendance_records SET note='Late update' WHERE id=1")
      .run()
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_source_freezes")
      .first<number>("n"),
  ).toBe(2)
})

test("置換INSERTでも停止世代と履歴を上書きできない", async () => {
  const f = await createAttendanceRecordSourceFixture(await local.database("replace-insert"))
  const first = freezeEntity()
  await f.database.batch([
    auditStatement(f.database, first, null),
    insertStatement(f.database, first),
  ])
  for (const snapshot of [
    freezeEntity().snapshot,
    { ...freezeEntity().snapshot, id: first.snapshot.id },
  ]) {
    const replacement = RecordSourceFreezeEntity.create(snapshot)
    if (replacement instanceof Error) throw replacement
    expect(
      await f.database
        .batch([
          auditStatement(f.database, replacement, null),
          insertStatement(f.database, replacement, true),
        ])
        .catch((error: unknown) => error),
    ).toBeInstanceOf(Error)
    expect(
      await f.database
        .prepare("SELECT snapshot_json FROM system_record_source_freezes WHERE id=?1")
        .bind(first.snapshot.id)
        .first<string>("snapshot_json"),
    ).toBe(JSON.stringify(first.snapshot))
  }
})
