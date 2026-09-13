import { expect, test } from "bun:test"
import { z } from "zod"
import { createAttendancePreservationFixture } from "@/contexts/attendance/test/create-attendance-preservation-fixture.test-support"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { PreservedRecordRepository } from "@system/infrastructure/repositories/records/preserved-record.repository"
import { PreparePreservedRecordRetentionGuardAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-retention-guard.adapter"

test("保持期限ちょうどから拒否し、準備済みの検査も実時間の経過後は保存を戻す", async () => {
  const f = await createAttendancePreservationFixture()
  await f.database.exec(
    "INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:record:preserve')",
  )
  const until = Date.now() + 5000
  const submitted = await f.request(f.path, {
    ...f.command,
    body: {
      procedure_key: f.definition.key,
      conditions: {
        ...f.conditions,
        preservation: {
          kind: "retention",
          retainUntil: new Date(until).toISOString(),
          reason: "Temporary test retention",
        },
      },
    },
  })
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), record_id: z.string() })
    .parse(await submitted.json())
  const env = { DB: f.database }
  const proposal = await new SystemD1ProposalAdapter({ env }).findByNumber(receipt.number)
  if (proposal === null || proposal instanceof Error) throw new Error("missing proposal")
  expect(
    (
      await f.request(`${f.path}/${receipt.number}/approve`, {
        accountId: f.reviewer.accountId,
        body: {
          decision_target: {
            proposal_version: proposal.version,
            proposal_digest: proposal.digest,
            task_key: proposal.currentTaskKey,
            task_round: proposal.currentTaskRound,
          },
          comment: "Approve timed retention",
        },
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await f.request(`${f.path}/${receipt.number}/execute`, {
        body: { proposal_digest: proposal.digest },
      })
    ).status,
  ).toBe(200)
  const record = await new PreservedRecordRepository({ env, assertions: [] }).find(
    receipt.record_id,
  )
  if (record === null || record instanceof Error) throw new Error("missing receipt")
  const adapter = new PreparePreservedRecordRetentionGuardAdapter({
    env,
    assertions: [f.database.prepare("SELECT 1")],
  })
  const proof = await adapter.prepare(record, new Date(until - 1))
  if (proof instanceof Error) throw proof
  await f.database.batch([...proof.assertions])
  expect(await adapter.prepare(record, new Date(until))).toBeInstanceOf(Error)
  expect(await adapter.prepare(record, new Date(until + 1))).toBeInstanceOf(Error)
  await f.database.exec("CREATE TABLE retention_expiry_receipts(id TEXT PRIMARY KEY)")
  await Bun.sleep(Math.max(0, until - Date.now() + 20))
  expect(
    await f.database
      .batch([
        f.database.prepare("INSERT INTO retention_expiry_receipts VALUES ('expired')"),
        ...proof.assertions,
      ])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM retention_expiry_receipts")
      .first<number>("n"),
  ).toBe(0)
}, 15000)
