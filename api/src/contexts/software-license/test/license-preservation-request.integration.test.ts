import { expect, test } from "bun:test"
import { z } from "zod"
import { createLicensePreservationFixture } from "@/contexts/software-license/test/create-license-preservation-fixture.test-support"

test("HTTP preservation submission validates current authority and replays only the original request", async () => {
  const fixture = await createLicensePreservationFixture()
  const f = fixture.f
  const bucket = fixture.bucket
  const path = fixture.path
  const conditions = fixture.conditions
  const command = fixture.command
  expect((await f.request(path, command)).status).toBe(403)
  expect(bucket.size()).toBe(0)
  await f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
  )
  const submitted = await f.request(path, command)
  if (submitted.status !== 201)
    throw new Error(`submission failed: ${submitted.status} ${await submitted.text()}`)
  const receiptSchema = z.strictObject({
    number: z.number().int().positive(),
    case_id: z.string(),
    record_id: z.uuid(),
    status: z.literal("pending"),
  })
  const receipt = receiptSchema.parse(await submitted.json())
  expect(bucket.size()).toBe(1)
  const replay = await f.request(path, command)
  expect(replay.status).toBe(200)
  expect(receiptSchema.parse(await replay.json())).toEqual(receipt)
  expect(bucket.size()).toBe(1)
  expect(
    (
      await f.request(path, {
        ...command,
        body: { ...command.body, conditions: { ...conditions, reason: "Different request" } },
      })
    ).status,
  ).toBe(409)
  expect(bucket.size()).toBe(1)
  const concurrentCommand = { ...command, headers: { "idempotency-key": crypto.randomUUID() } }
  const concurrent = await Promise.all([
    f.request(path, concurrentCommand),
    f.request(path, concurrentCommand),
  ])
  expect(concurrent.map((response) => response.status).sort((left, right) => left - right)).toEqual(
    [200, 201],
  )
  expect(receiptSchema.parse(await concurrent[0]?.json())).toEqual(
    receiptSchema.parse(await concurrent[1]?.json()),
  )
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS count FROM system_proposals WHERE procedure_key='record-preservation'",
      )
      .first<number>("count"),
  ).toBe(2)
  const storedObjects = bucket.size()
  await f.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE permission_key='system:record:preserve'",
  )
  expect((await f.request(path, command)).status).toBe(403)
  expect(bucket.size()).toBe(storedObjects)
})
