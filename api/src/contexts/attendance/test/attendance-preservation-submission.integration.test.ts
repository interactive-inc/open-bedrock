import { expect, test } from "bun:test"
import { z } from "zod"
import { createAttendancePreservationFixture } from "@/contexts/attendance/test/create-attendance-preservation-fixture.test-support"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"

const receiptSchema = z.strictObject({
  number: z.number().int().positive(),
  case_id: z.string(),
  record_id: z.uuid(),
  status: z.literal("pending"),
})

test("attendance submission requires both source and preservation permission and replays only the original request", async () => {
  const f = await createAttendancePreservationFixture()
  expect((await f.request(f.path, { ...f.command, anonymous: true })).status).toBe(401)
  expect((await f.request(f.path, f.command)).status).toBe(403)
  expect(f.bucket.size()).toBe(0)
  await f.database.exec(
    "INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:record:preserve')",
  )
  const submitted = await f.request(f.path, f.command)
  if (submitted.status !== 201)
    throw new Error(`submission failed: ${submitted.status} ${await submitted.text()}`)
  expect(submitted.headers.get("cache-control")).toBe("no-store")
  const receipt = receiptSchema.parse(await submitted.json())
  const stored = await openSystemProposals({ env: { DB: f.database } }).findByNumber(receipt.number)
  if (stored === null || stored instanceof Error) throw new Error("missing stored proposal")
  const body = JSON.parse(stored.bodyJson)
  expect(body.source).toMatchObject({
    ownerContext: "attendance",
    recordKind: "attendance-record",
    recordId: "01900016-0000-7000-8000-000000000001",
    sourceRevision: null,
    sourceRecordedAt: null,
  })
  expect(body.actorAccountId).toBe(f.governance.creator.accountId)
  expect(f.bucket.size()).toBe(1)
  const replay = await f.request(f.path, f.command)
  expect(replay.status).toBe(200)
  expect(receiptSchema.parse(await replay.json())).toEqual(receipt)
  expect(f.bucket.size()).toBe(1)
  expect(
    (
      await f.request(f.path, {
        ...f.command,
        body: { ...f.command.body, conditions: { ...f.conditions, reason: "Changed" } },
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await f.request(
        "/attendance-records/01900016-0000-7000-8000-000000000002/preservation-requests",
        f.command,
      )
    ).status,
  ).toBe(409)
  const parallel = { ...f.command, key: crypto.randomUUID() }
  const responses = await Promise.all([f.request(f.path, parallel), f.request(f.path, parallel)])
  expect(responses.map((response) => response.status).sort((left, right) => left - right)).toEqual([
    200, 201,
  ])
  expect(receiptSchema.parse(await responses[0]?.json())).toEqual(
    receiptSchema.parse(await responses[1]?.json()),
  )
  await f.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE permission_key='attendance:read:all'",
  )
  expect((await f.request(f.path, f.command)).status).toBe(403)
})

test("a source update during encrypted upload cannot leave an accepted preservation proposal", async () => {
  const f = await createAttendancePreservationFixture()
  await f.database.exec(
    "INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:record:preserve')",
  )
  const originalPut = f.bucket.put.bind(f.bucket)
  f.bucket.put = async (key, value, options) => {
    const written = await originalPut(key, value, options)
    await f.database.exec(
      "UPDATE attendance_records SET note='Changed during upload' WHERE id='01900016-0000-7000-8000-000000000001'",
    )
    return written
  }
  expect((await f.request(f.path, f.command)).status).toBe(409)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS count FROM system_proposals WHERE procedure_key='attendance-preservation'",
      )
      .first<number>("count"),
  ).toBe(0)
})

test("missing namespace, missing idempotency key and a pending resubmission are refused", async () => {
  const f = await createAttendancePreservationFixture()
  await f.database.exec(
    "INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:record:preserve')",
  )
  f.settings.sourceNamespace = ""
  expect((await f.request(f.path, f.command)).status).toBe(503)
  expect(f.bucket.size()).toBe(0)
  f.settings.sourceNamespace = "example-source"
  expect((await f.request(f.path, { body: f.command.body })).status).toBe(400)
  const submitted = await f.request(f.path, f.command)
  const receipt = receiptSchema.parse(await submitted.json())
  expect(
    (
      await f.request(`${f.path}/${receipt.number}/resubmit`, {
        body: { ...f.command.body, previous_version: 1, previous_digest: "0".repeat(64) },
      })
    ).status,
  ).toBe(409)
})
