import { expect, test } from "bun:test"
import { createLeaveProcedureTestContext } from "@/contexts/leave/test/leave-procedure.test-support"

test("休暇とSystem案件を同時に保存し、内容改変と直接承認を拒否する", async () => {
  const c = await createLeaveProcedureTestContext()
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
  const c = await createLeaveProcedureTestContext()
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
