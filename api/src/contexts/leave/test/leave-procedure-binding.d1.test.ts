import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createLeaveProcedureLocalD1Context } from "@/contexts/leave/test/leave-procedure-local-d1.test-support"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["submit-with-case", "changed-leave"],
  })
})

afterAll(async () => {
  await local.dispose()
})

test("休暇とSystem案件を同時に保存し、内容改変と直接承認を拒否する", async () => {
  const c = await createLeaveProcedureLocalD1Context(local, "submit-with-case")
  const saved = await c.repository.submit(c.submission)
  expect(saved).not.toBeInstanceOf(Error)
  if (saved instanceof Error) throw saved
  expect(saved.leaveRequestId).toBe(c.requestId)
  for (const sql of [
    "UPDATE leave_requests SET reason = 'changed' WHERE id = ?1",
    "UPDATE leave_requests SET status = 'approved' WHERE id = ?1",
  ]) {
    const rejected = await c.database
      .prepare(sql)
      .bind(c.requestId)
      .run()
      .then(
        () => null,
        (error: unknown) => error,
      )
    expect(rejected).toBeInstanceOf(Error)
  }
  expect(await c.repository.findForRequest(c.requestId)).toEqual(saved)
})

test("変わった休暇への提出はSystem案件ごと取り消す", async () => {
  const c = await createLeaveProcedureLocalD1Context(local, "changed-leave")
  await c.database
    .prepare("UPDATE leave_requests SET reason = 'changed' WHERE id = ?1")
    .bind(c.requestId)
    .run()
  expect(await c.repository.submit(c.submission)).toBeInstanceOf(Error)
  expect(await c.repository.findForRequest(c.requestId)).toBeNull()
  expect(
    await c.database.prepare("SELECT count(*) AS count FROM system_cases").first<number>("count"),
  ).toBe(0)
  expect(
    await c.database
      .prepare("SELECT count(*) AS count FROM system_proposals")
      .first<number>("count"),
  ).toBe(0)
})
