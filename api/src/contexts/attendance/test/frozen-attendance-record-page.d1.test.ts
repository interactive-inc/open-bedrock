import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createAttendanceRecordSourceFixture } from "@/contexts/attendance/test/create-attendance-record-source-fixture.test-support"
import { ListFrozenAttendanceRecordPageAdapter } from "@/contexts/attendance/infrastructure/adapters/list-frozen-attendance-record-page.adapter"
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
    migrated: ["bound-pages", "empty-target", "over-page-limit"],
  })
})

afterAll(async () => {
  await local.dispose()
})

test("欠番・複数ページを停止世代へ束縛し、解除して再停止しても旧ページを確定できない", async () => {
  const f = await createAttendanceRecordSourceFixture(await local.database("bound-pages"))
  // 主キーは変更できないので、欠番は削除と別IDでの再作成で作る。
  await f.database.batch([
    f.database.prepare(
      "DELETE FROM attendance_records WHERE id='01900016-0000-7000-8000-000000000002'",
    ),
    f.database.prepare(
      "INSERT INTO attendance_records (id,employee_id,work_date,status) VALUES ('01900016-0000-7000-8000-000000000384','employee:worker','2026-08-31','closed')",
    ),
  ])
  const repository = openSystemRecordSourceFreezes({ env: f.context.env, assertions: [] })
  const command = {
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "attendance",
    actorAccountId: f.authentication.accountId,
    reason: "Preserve source",
  }
  const adapter = new ListFrozenAttendanceRecordPageAdapter(f.context)
  const input = {
    freezeId: command.id,
    sourceNamespace: command.sourceNamespace,
    afterId: "01900016-0000-7000-8000-000000000000",
    limit: 1,
  }
  expect(await adapter.prepare(input)).toBeInstanceOf(Error)
  expect(
    await new CreateRecordSourceFreeze({ repository }).execute(command, f.clock.now),
  ).toMatchObject({ kind: "created" })
  const first = await adapter.prepare(input)
  if (first instanceof Error) throw first
  expect(first.recordIds).toEqual(["01900016-0000-7000-8000-000000000001"])
  expect(first.nextAfterId).toBe("01900016-0000-7000-8000-000000000001")
  const last = await adapter.prepare({ ...input, afterId: "01900016-0000-7000-8000-000000000001" })
  if (last instanceof Error) throw last
  expect(last.recordIds).toEqual(["01900016-0000-7000-8000-000000000384"])
  expect(last.nextAfterId).toBeNull()
  const all = await adapter.prepare({ ...input, limit: 100 })
  if (all instanceof Error) throw all
  expect(all.recordIds).toEqual([
    "01900016-0000-7000-8000-000000000001",
    "01900016-0000-7000-8000-000000000384",
  ])
  expect(all.nextAfterId).toBeNull()
  expect(await adapter.prepare({ ...input, sourceNamespace: "other" })).toBeInstanceOf(Error)
  expect(await adapter.prepare({ ...input, limit: 101 })).toBeInstanceOf(Error)
  await f.database.batch([...first.assertions])
  expect(
    await new ReleaseRecordSourceFreeze({ repository }).execute(command, f.clock.now),
  ).toMatchObject({ kind: "released" })
  expect(
    await new CreateRecordSourceFreeze({ repository }).execute(
      { ...command, id: crypto.randomUUID() },
      f.clock.now,
    ),
  ).toMatchObject({ kind: "created" })
  expect(await adapter.prepare(input)).toBeInstanceOf(Error)
  expect(
    await f.database
      .batch([
        f.database.prepare("INSERT INTO capture_test_receipts VALUES ('stale')"),
        ...last.assertions,
      ])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await f.database.prepare("SELECT count(*) AS n FROM capture_test_receipts").first<number>("n"),
  ).toBe(0)
})

test("空の停止対象は空ページを返すが、取得後の権限取消では確定できない", async () => {
  const f = await createAttendanceRecordSourceFixture(await local.database("empty-target"))
  await execSql(f.database, "DELETE FROM attendance_records")
  const repository = openSystemRecordSourceFreezes({ env: f.context.env, assertions: [] })
  const id = crypto.randomUUID()
  await new CreateRecordSourceFreeze({ repository }).execute(
    {
      id,
      sourceNamespace: "example-source",
      ownerContext: "attendance",
      actorAccountId: f.authentication.accountId,
      reason: "Preserve empty source",
    },
    f.clock.now,
  )
  const adapter = new ListFrozenAttendanceRecordPageAdapter(f.context)
  const input = {
    freezeId: id,
    sourceNamespace: "example-source",
    afterId: "01900016-0000-7000-8000-000000000000",
    limit: 100,
  }
  const page = await adapter.prepare(input)
  if (page instanceof Error) throw page
  expect(page.recordIds).toEqual([])
  expect(page.nextAfterId).toBeNull()
  await execSql(
    f.database,
    "DELETE FROM system_iam_role_permissions WHERE role_id='0a05519b-05c9-4925-8b15-fcb647569867'",
  )
  expect(await adapter.prepare(input)).toBeInstanceOf(Error)
  expect(
    await f.database.batch([...page.assertions]).catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
})

test("100件の上限を超える原記録を重複なく全ページ取得する", async () => {
  const f = await createAttendanceRecordSourceFixture(await local.database("over-page-limit"))
  await execSql(
    f.database,
    `WITH RECURSIVE ids(n) AS (SELECT 3 UNION ALL SELECT n+1 FROM ids WHERE n<205)
    INSERT INTO attendance_records (id,employee_id,work_date,status)
    SELECT printf('01900016-0000-7000-8000-%012x', n),'employee:worker','2026-09-01','closed' FROM ids`,
  )
  const id = crypto.randomUUID()
  const repository = openSystemRecordSourceFreezes({ env: f.context.env, assertions: [] })
  await new CreateRecordSourceFreeze({ repository }).execute(
    {
      id,
      sourceNamespace: "example-source",
      ownerContext: "attendance",
      actorAccountId: f.authentication.accountId,
      reason: "Preserve all pages",
    },
    f.clock.now,
  )
  const adapter = new ListFrozenAttendanceRecordPageAdapter(f.context)
  const recordId = (serial: number) =>
    `01900016-0000-7000-8000-${serial.toString(16).padStart(12, "0")}`
  const pages: string[][] = []
  for (const after of [0, 100, 200]) {
    const page = await adapter.prepare({
      freezeId: id,
      sourceNamespace: "example-source",
      afterId: recordId(after),
      limit: 100,
    })
    if (page instanceof Error) throw page
    expect(page.recordIds.length).toBeLessThanOrEqual(100)
    expect(page.nextAfterId).toBe(after === 200 ? null : recordId(after + 100))
    pages.push([...page.recordIds])
    await f.database.batch([...page.assertions])
  }
  expect(pages.flat()).toEqual(Array.from({ length: 205 }, (_, index) => recordId(index + 1)))
})
