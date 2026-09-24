import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createAttendanceRecordSourceFixture } from "@/contexts/attendance/test/create-attendance-record-source-fixture.test-support"
import { CaptureAttendanceRecordAdapter } from "@/contexts/attendance/infrastructure/adapters/capture-attendance-record.adapter"
import { PreservedRecordContentValue } from "@system/domain/values/records/preserved-record-content.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import { execSql } from "@tests/d1/support/exec-sql"

const sourceMutations = [
  "UPDATE attendance_records SET clock_out_at='2026-09-01T08:00:00Z',work_minutes=480,status='closed' WHERE id=1",
  "UPDATE attendance_records SET note='Correction' WHERE id=1",
  "UPDATE attendance_records SET work_date='2026-08-30' WHERE id=1",
  "UPDATE attendance_records SET clock_in_at='2026-09-01T01:00:00Z' WHERE id=1",
  "DELETE FROM attendance_records WHERE id=1",
]

const authorizationMutations = [
  "DELETE FROM system_iam_role_permissions WHERE permission_key='attendance:read:all'",
  "UPDATE system_accounts SET token_version=1",
  "UPDATE system_accounts SET status='suspended',token_version=1,updated_at=1",
  "UPDATE system_role_bindings SET revoked_at=1",
  `UPDATE system_role_bindings SET revoked_at=1;
      INSERT INTO system_role_bindings (id,account_id,role_id,resource_type,resource_id,created_at)
      VALUES ('binding:scoped','account:recorder','role:recorder','employee','employee:worker',1)`,
]

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "all-original-fields-survive-capture-without",
      ...sourceMutations.map((_, index) => `source-mutation-${index}`),
      "revalidation-retains-capture-time-and",
      "inventory-includes-open-and-closed-records",
      ...authorizationMutations.map((_, index) => `authorization-mutation-${index}`),
      "missing-and-expired-credentials-cannot",
      "a-token-that-expires-after-capture-cannot",
      "large-integer-precision",
      "version-1-digest",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

test("all original fields survive capture without invented revision or recorded time", async () => {
  const f = await createAttendanceRecordSourceFixture(
    await local.database("all-original-fields-survive-capture-without"),
  )
  for (const recordId of [1, 2]) {
    const captured = await f.capture.prepare({ ...f.input, recordId })
    if (captured instanceof Error) throw captured
    expect(
      await PreservedRecordContentValue.create(captured.source, captured.content),
    ).not.toBeInstanceOf(Error)
    expect(JSON.parse(new TextDecoder().decode(captured.content))).toEqual({
      format: "attendance-record",
      version: 2,
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

test.each(sourceMutations)("source mutation rolls back finalization: %s", async (mutation) => {
  const f = await createAttendanceRecordSourceFixture(
    await local.database(`source-mutation-${sourceMutations.indexOf(mutation)}`),
  )
  const captured = await f.capture.prepare(f.input)
  if (captured instanceof Error) throw captured
  await execSql(f.database, mutation)
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
})

test("revalidation retains capture time and rejects altered provenance or content", async () => {
  const f = await createAttendanceRecordSourceFixture(
    await local.database("revalidation-retains-capture-time-and"),
  )
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
    { formatVersion: 3 },
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
  const f = await createAttendanceRecordSourceFixture(
    await local.database("inventory-includes-open-and-closed-records"),
  )
  const initial = await f.inventory.prepare()
  if (initial instanceof Error) throw initial
  expect(initial.recordIds).toEqual([1, 2])
  await f.database.batch([...initial.assertions])
  await execSql(
    f.database,
    `INSERT INTO attendance_records
    (id,employee_id,work_date,note,status) VALUES (3,'employee:worker','2026-08-30','Unprovided times','closed')`,
  )
  expect(
    await f.database.batch([...initial.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  const added = await f.inventory.prepare()
  if (added instanceof Error) throw added
  expect(added.recordIds).toEqual([1, 2, 3])
  await execSql(f.database, "DELETE FROM attendance_records WHERE id=2")
  expect(
    await f.database.batch([...added.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  await execSql(f.database, "DELETE FROM attendance_records")
  const empty = await f.inventory.prepare()
  if (empty instanceof Error) throw empty
  expect(empty.recordIds).toEqual([])
  await f.database.batch([...empty.assertions])
})

test.each(authorizationMutations)(
  "current source authorization is rechecked at finalization: %s",
  async (mutation) => {
    const f = await createAttendanceRecordSourceFixture(
      await local.database(`authorization-mutation-${authorizationMutations.indexOf(mutation)}`),
    )
    const captured = await f.capture.prepare(f.input)
    const inventory = await f.inventory.prepare()
    if (captured instanceof Error) throw captured
    if (inventory instanceof Error) throw inventory
    await execSql(f.database, mutation)
    expect(await f.capture.prepare(f.input)).toBeInstanceOf(Error)
    expect(await f.inventory.prepare()).toBeInstanceOf(Error)
    expect(await f.revalidate.prepare(captured.source)).toBeInstanceOf(Error)
    expect(
      await f.database.batch([...captured.assertions]).catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
    expect(
      await f.database.batch([...inventory.assertions]).catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
  },
)

test("missing and expired credentials cannot capture source records", async () => {
  const f = await createAttendanceRecordSourceFixture(
    await local.database("missing-and-expired-credentials-cannot"),
  )
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
  const f = await createAttendanceRecordSourceFixture(
    await local.database("a-token-that-expires-after-capture-cannot"),
  )
  const expiresAtMs = Date.now() + 5000
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
}, 15_000)

test("DBの整数を丸めず保存し、隣接する大きな整数の変更も識別する", async () => {
  const f = await createAttendanceRecordSourceFixture(
    await local.database("large-integer-precision"),
  )
  await execSql(
    f.database,
    "UPDATE attendance_records SET work_minutes=9007199254740993 WHERE id=1",
  )
  const first = await f.capture.prepare(f.input)
  if (first instanceof Error) throw first
  expect(first.source.props.formatVersion).toBe(2)
  expect(new TextDecoder().decode(first.content)).toContain('"work_minutes":9007199254740993')
  expect(await PreservedRecordContentValue.create(first.source, first.content)).not.toBeInstanceOf(
    Error,
  )
  const revalidated = await f.revalidate.prepare(first.source)
  if (revalidated instanceof Error) throw revalidated
  expect(revalidated.content).toEqual(first.content)
  expect(await f.capture.prepare({ ...f.input, formatVersion: 1 })).toBeInstanceOf(Error)
  await execSql(
    f.database,
    "UPDATE attendance_records SET work_minutes=9007199254740992 WHERE id=1",
  )
  const second = await f.capture.prepare(f.input)
  if (second instanceof Error) throw second
  expect(new TextDecoder().decode(second.content)).toContain('"work_minutes":9007199254740992')
  expect(second.source.props.contentDigest).not.toBe(first.source.props.contentDigest)
  expect(await f.revalidate.prepare(first.source)).toBeInstanceOf(Error)
  expect(
    await f.database.batch([...first.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
})

test("既存の版1の承認対象は元の本文とdigestで再検証する", async () => {
  const f = await createAttendanceRecordSourceFixture(await local.database("version-1-digest"))
  const current = await f.capture.prepare(f.input)
  if (current instanceof Error) throw current
  const original = CanonicalSystemJsonValue.create({
    format: "attendance-record",
    version: 1,
    record: await f.database.prepare("SELECT * FROM attendance_records WHERE id=1").first(),
  })
  if (original instanceof Error) throw original
  const content = new TextEncoder().encode(original.toString())
  const source = PreservedRecordSourceValue.create({
    ...current.source.props,
    formatVersion: 1,
    contentDigest: await toSha256Hex(content),
  })
  if (source instanceof Error) throw source
  const revalidated = await f.revalidate.prepare(source)
  if (revalidated instanceof Error) throw revalidated
  expect(revalidated.source.props).toEqual(source.props)
  expect(revalidated.content).toEqual(content)
  await f.database.batch([...revalidated.assertions])
  await execSql(f.database, "UPDATE attendance_records SET note='Corrected' WHERE id=1")
  expect(await f.revalidate.prepare(source)).toBeInstanceOf(Error)
})
