import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createAttendanceRecordSourceFixture } from "@/contexts/attendance/test/create-attendance-record-source-fixture.test-support"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { CreateRecordSourceFreeze } from "@system/application/records/create-record-source-freeze"
import { ReleaseRecordSourceFreeze } from "@system/application/records/release-record-source-freeze"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import { execSql } from "@tests/d1/support/exec-sql"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["concurrent-replay", "replay-authorization"],
  })
})

afterAll(async () => {
  await local.dispose()
})

test("停止と解除の同時再送は履歴を増やさず、再停止は新しいIDを要求する", async () => {
  const f = await createAttendanceRecordSourceFixture(await local.database("concurrent-replay"))
  const repository = openSystemRecordSourceFreezes({ env: f.context.env, assertions: [] })
  const create = new CreateRecordSourceFreeze({ repository })
  const release = new ReleaseRecordSourceFreeze({ repository })
  const command = {
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "attendance",
    actorAccountId: "account:recorder",
    reason: "Preserve the source",
  }
  const now = new Date()
  const created = await Promise.all([create.execute(command, now), create.execute(command, now)])
  expect(created).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "created" }),
      expect.objectContaining({ kind: "replayed" }),
    ]),
  )
  expect(await create.execute({ ...command, reason: "Different instruction" }, now)).toBe(
    "conflict",
  )
  expect(await create.execute({ ...command, id: crypto.randomUUID() }, now)).toBe("conflict")
  const releaseCommand = { ...command, reason: "Resume the source" }
  expect(await release.execute({ ...releaseCommand, sourceNamespace: "other-source" }, now)).toBe(
    "not_found",
  )
  const released = await Promise.all([
    release.execute(releaseCommand, now),
    release.execute(releaseCommand, now),
  ])
  expect(released).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "released" }),
      expect.objectContaining({ kind: "replayed" }),
    ]),
  )
  expect(await release.execute({ ...releaseCommand, reason: "Different release" }, now)).toBe(
    "conflict",
  )
  const replay = await create.execute(command, now)
  if (replay instanceof Error || typeof replay === "string")
    throw new Error("creation replay failed")
  expect(replay.kind).toBe("replayed")
  expect(replay.freeze.snapshot.release?.reason).toBe("Resume the source")
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE target_type='system:record-source-freeze'",
      )
      .first<number>("n"),
  ).toBe(2)
  expect(await create.execute({ ...command, id: crypto.randomUUID() }, now)).toMatchObject({
    kind: "created",
  })
})

test("再送にも現在のDB権限条件を要求し、監査保存失敗では停止しない", async () => {
  const f = await createAttendanceRecordSourceFixture(await local.database("replay-authorization"))
  await execSql(
    f.database,
    `CREATE TABLE freeze_test_permission (allowed INTEGER NOT NULL); INSERT INTO freeze_test_permission VALUES (1)`,
  )
  const repository = openSystemRecordSourceFreezes({
    env: f.context.env,
    assertions: [
      f.database.prepare(
        "SELECT CASE WHEN (SELECT allowed FROM freeze_test_permission)=1 THEN 1 ELSE json_extract('{}','freeze_test_denied') END",
      ),
    ],
  })
  const create = new CreateRecordSourceFreeze({ repository })
  const command = {
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "attendance",
    actorAccountId: "account:recorder",
    reason: "Preserve the source",
  }
  await execSql(
    f.database,
    `CREATE TRIGGER freeze_test_audit_failure BEFORE INSERT ON system_audit_events
    WHEN NEW.action='system.record.source.freeze.created' BEGIN SELECT RAISE(ABORT,'test_audit_failure'); END;`,
  )
  expect(await create.execute(command, new Date())).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_source_freezes")
      .first<number>("n"),
  ).toBe(0)
  await execSql(f.database, "DROP TRIGGER freeze_test_audit_failure")
  expect(await create.execute(command, new Date())).toMatchObject({ kind: "created" })
  await execSql(f.database, "UPDATE freeze_test_permission SET allowed=0")
  expect(await create.execute(command, new Date())).toBeInstanceOf(Error)
  expect(
    await new ReleaseRecordSourceFreeze({ repository }).execute(
      { ...command, reason: "Resume" },
      new Date(),
    ),
  ).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT revision FROM system_record_source_freezes")
      .first<number>("revision"),
  ).toBe(1)
})
