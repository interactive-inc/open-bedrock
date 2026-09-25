import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { createAttendancePreservationFixture } from "@/contexts/attendance/test/create-attendance-preservation-fixture.test-support"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { openSystemPreservedRecords } from "@system/interface/operations/open-system-preserved-records"
import { prepareSystemPreservedRecordRetentionGuard } from "@system/interface/operations/prepare-system-preserved-record-retention-guard"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"
import { execSql } from "@tests/d1/support/exec-sql"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(1)
})

afterAll(async () => {
  await pool.dispose()
})

test("保持期限ちょうどから拒否し、準備済みの検査も実時間の経過後は保存を戻す", async () => {
  const f = await createAttendancePreservationFixture(await pool.next())
  await execSql(
    f.database,
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
  const proposal = await openSystemProposals({ env }).findByNumber(receipt.number)
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
  const record = await openSystemPreservedRecords({ env, assertions: [] }).find(receipt.record_id)
  if (record === null || record instanceof Error) throw new Error("missing receipt")
  const adapterContext = {
    env,
    assertions: [f.database.prepare("SELECT 1")],
  }
  const proof = await prepareSystemPreservedRecordRetentionGuard(
    adapterContext,
    record,
    new Date(until - 1),
  )
  if (proof instanceof Error) throw proof
  await f.database.batch([...proof.assertions])
  expect(
    await prepareSystemPreservedRecordRetentionGuard(adapterContext, record, new Date(until)),
  ).toBeInstanceOf(Error)
  expect(
    await prepareSystemPreservedRecordRetentionGuard(adapterContext, record, new Date(until + 1)),
  ).toBeInstanceOf(Error)
  await execSql(f.database, "CREATE TABLE retention_expiry_receipts(id TEXT PRIMARY KEY)")
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
