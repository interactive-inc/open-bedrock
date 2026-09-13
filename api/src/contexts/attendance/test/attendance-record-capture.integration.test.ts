import { expect, test } from "bun:test"
import { createAttendanceRecordSourceFixture } from "@/contexts/attendance/test/create-attendance-record-source-fixture.test-support"
import { CaptureAttendanceRecordAdapter } from "@/contexts/attendance/infrastructure/adapters/capture-attendance-record.adapter"
import { PreservedRecordContentValue } from "@system/domain/values/records/preserved-record-content.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"

test("all original fields survive capture without invented revision or recorded time", async () => {
  const f = await createAttendanceRecordSourceFixture()
  for (const recordId of [1, 2]) {
    const captured = await f.capture.prepare({ ...f.input, recordId })
    if (captured instanceof Error) throw captured
    expect(
      await PreservedRecordContentValue.create(captured.source, captured.content),
    ).not.toBeInstanceOf(Error)
    expect(JSON.parse(new TextDecoder().decode(captured.content))).toEqual({
      format: "attendance-record",
      version: 1,
      record: await f.database
        .prepare("SELECT * FROM attendance_records WHERE id=?1")
        .bind(recordId)
        .first(),
    })
    expect(captured.source.props).toMatchObject({
      ownerContext: "attendance",
      recordId: String(recordId),
      sourceRevision: null,
      sourceRecordedAt: null,
      capturedAt: f.clock.now.toISOString(),
    })
    await f.database.batch([...captured.assertions])
  }
  for (const recordId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 999])
    expect(await f.capture.prepare({ ...f.input, recordId })).toBeInstanceOf(Error)
})

test("clock-out and every other source mutation invalidate capture and roll back finalization", async () => {
  for (const mutation of [
    "UPDATE attendance_records SET clock_out_at='2026-09-01T08:00:00Z',work_minutes=480,status='closed' WHERE id=1",
    "UPDATE attendance_records SET note='Correction' WHERE id=1",
    "UPDATE attendance_records SET work_date='2026-08-30' WHERE id=1",
    "UPDATE attendance_records SET clock_in_at='2026-09-01T01:00:00Z' WHERE id=1",
    "DELETE FROM attendance_records WHERE id=1",
  ]) {
    const f = await createAttendanceRecordSourceFixture()
    const captured = await f.capture.prepare(f.input)
    if (captured instanceof Error) throw captured
    await f.database.exec(mutation)
    expect(await f.revalidate.prepare(captured.source)).toBeInstanceOf(Error)
    expect(
      await f.database
        .batch([
          f.database.prepare("INSERT INTO capture_test_receipts VALUES ('finalized')"),
          ...captured.assertions,
        ])
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM capture_test_receipts")
        .first<{ count: number }>(),
    ).toEqual({ count: 0 })
  }
})

test("revalidation retains capture time and rejects altered provenance or content", async () => {
  const f = await createAttendanceRecordSourceFixture()
  const captured = await f.capture.prepare(f.input)
  if (captured instanceof Error) throw captured
  f.clock.now = new Date(f.clock.now.getTime() + 1000)
  const current = await f.revalidate.prepare(captured.source)
  if (current instanceof Error) throw current
  expect(current.source.props).toEqual(captured.source.props)
  expect(current.content).toEqual(captured.content)
  await f.database.batch([...current.assertions])
  for (const replacement of [
    { sourceNamespace: "other-source" },
    { ownerContext: "other-context" },
    { recordKind: "other-record" },
    { recordId: "01" },
    { formatId: "other-format" },
    { formatVersion: 2 },
    { sourceRevision: "1" },
    { sourceRecordedAt: "2026-09-01T00:00:00Z" },
    { capturedAt: new Date(f.clock.now.getTime() + 1000).toISOString() },
    { contentDigest: "0".repeat(64) },
  ]) {
    const changed = PreservedRecordSourceValue.create({ ...captured.source.props, ...replacement })
    if (changed instanceof Error) throw changed
    expect(await f.revalidate.prepare(changed)).toBeInstanceOf(Error)
  }
})

test("inventory includes open and closed records and detects added or removed records", async () => {
  const f = await createAttendanceRecordSourceFixture()
  const initial = await f.inventory.prepare()
  if (initial instanceof Error) throw initial
  expect(initial.recordIds).toEqual([1, 2])
  await f.database.batch([...initial.assertions])
  await f.database.exec(`INSERT INTO attendance_records
    (id,employee_id,work_date,note,status) VALUES (3,'employee:worker','2026-08-30','Unprovided times','closed')`)
  expect(
    await f.database.batch([...initial.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  const added = await f.inventory.prepare()
  if (added instanceof Error) throw added
  expect(added.recordIds).toEqual([1, 2, 3])
  await f.database.exec("DELETE FROM attendance_records WHERE id=2")
  expect(
    await f.database.batch([...added.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  await f.database.exec("DELETE FROM attendance_records")
  const empty = await f.inventory.prepare()
  if (empty instanceof Error) throw empty
  expect(empty.recordIds).toEqual([])
  await f.database.batch([...empty.assertions])
})

test("current global read permission and credential remain required through finalization", async () => {
  for (const mutation of [
    "DELETE FROM system_iam_role_permissions WHERE permission_key='attendance:read:all'",
    "UPDATE system_accounts SET token_version=1",
    "UPDATE system_accounts SET status='suspended',token_version=1,updated_at=1",
    "UPDATE system_role_bindings SET revoked_at=1",
    `UPDATE system_role_bindings SET revoked_at=1;
      INSERT INTO system_role_bindings (id,account_id,role_id,resource_type,resource_id,created_at)
      VALUES ('binding:scoped','account:recorder','role:recorder','employee','employee:worker',1)`,
  ]) {
    const f = await createAttendanceRecordSourceFixture()
    const captured = await f.capture.prepare(f.input)
    const inventory = await f.inventory.prepare()
    if (captured instanceof Error) throw captured
    if (inventory instanceof Error) throw inventory
    await f.database.exec(mutation)
    expect(await f.capture.prepare(f.input)).toBeInstanceOf(Error)
    expect(await f.inventory.prepare()).toBeInstanceOf(Error)
    expect(await f.revalidate.prepare(captured.source)).toBeInstanceOf(Error)
    expect(
      await f.database.batch([...captured.assertions]).catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
    expect(
      await f.database.batch([...inventory.assertions]).catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
  }
  const f = await createAttendanceRecordSourceFixture()
  expect(
    await new CaptureAttendanceRecordAdapter({
      env: f.context.env,
      var: { now: f.context.var.now },
    }).prepare(f.input),
  ).toBeInstanceOf(Error)
  const expired = new CaptureAttendanceRecordAdapter({
    ...f.context,
    var: {
      ...f.context.var,
      bearerReadAuthentication: { ...f.authentication, issuedAtMs: 0, expiresAtMs: 1 },
    },
  })
  expect(await expired.prepare(f.input)).toBeInstanceOf(Error)
})

test("a token that expires after capture cannot authorize a later finalization batch", async () => {
  const f = await createAttendanceRecordSourceFixture()
  const expiresAtMs = Date.now() + 1000
  const capture = new CaptureAttendanceRecordAdapter({
    ...f.context,
    var: {
      ...f.context.var,
      bearerReadAuthentication: { ...f.authentication, expiresAtMs },
    },
  })
  const captured = await capture.prepare(f.input)
  if (captured instanceof Error) throw captured
  await f.database.batch([...captured.assertions])
  await Bun.sleep(Math.max(0, expiresAtMs - Date.now()) + 20)
  expect(
    await f.database
      .batch([
        f.database.prepare("INSERT INTO capture_test_receipts VALUES ('expired')"),
        ...captured.assertions,
      ])
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT count(*) AS count FROM capture_test_receipts")
      .first<number>("count"),
  ).toBe(0)
})
