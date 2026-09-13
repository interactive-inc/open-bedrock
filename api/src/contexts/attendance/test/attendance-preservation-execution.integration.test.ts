import { expect, test } from "bun:test"
import { z } from "zod"
import { createAttendancePreservationFixture } from "@/contexts/attendance/test/create-attendance-preservation-fixture.test-support"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"

test("保全確定APIは認証・権限・原記録の対応・承認済み状態を要求する", async () => {
  const f = await createAttendancePreservationFixture()
  await f.database.exec(
    "INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:record:preserve')",
  )
  const submitted = await f.request(f.path, f.command)
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), record_id: z.string() })
    .parse(await submitted.json())
  const proposal = await new SystemD1ProposalAdapter({ env: { DB: f.database } }).findByNumber(
    receipt.number,
  )
  if (proposal === null || proposal instanceof Error) throw new Error("missing proposal")
  const path = `${f.path}/${receipt.number}/execute`
  const command = { body: { proposal_digest: proposal.digest } }
  expect((await f.request(path, { ...command, anonymous: true })).status).toBe(401)
  expect((await f.request(path, { body: { proposal_digest: "invalid" } })).status).toBe(400)
  expect((await f.request(path, { body: { proposal_digest: "0".repeat(64) } })).status).toBe(409)
  expect(
    (
      await f.request(
        `/attendance-records/2/preservation-requests/${receipt.number}/execute`,
        command,
      )
    ).status,
  ).toBe(403)
  expect((await f.request(path, command)).status).toBe(409)
  f.settings.sourceNamespace = "different-source"
  expect((await f.request(path, command)).status).toBe(403)
  f.settings.sourceNamespace = ""
  expect((await f.request(path, command)).status).toBe(503)
  f.settings.sourceNamespace = "example-source"
  await f.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE permission_key='system:record:preserve'",
  )
  expect((await f.request(path, command)).status).toBe(403)
  const unchanged = await new SystemD1ProposalAdapter({ env: { DB: f.database } }).findByNumber(
    receipt.number,
  )
  if (unchanged === null || unchanged instanceof Error) throw new Error("missing proposal")
  expect(unchanged.status).toBe("pending")
  expect(unchanged.digest).toBe(proposal.digest)
})

test("会社資格を持つ別の人間が承認した原記録だけを一回確定し、判断と実行の再送を受理する", async () => {
  const f = await createAttendancePreservationFixture()
  await f.database.exec(
    "INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:record:preserve')",
  )
  const submitted = await f.request(f.path, f.command)
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), record_id: z.string() })
    .parse(await submitted.json())
  const query = new SystemD1ProposalAdapter({ env: { DB: f.database } })
  const proposal = await query.findByNumber(receipt.number)
  if (proposal === null || proposal instanceof Error) throw new Error("missing proposal")
  const path = `${f.path}/${receipt.number}`
  const decision = {
    body: {
      decision_target: {
        proposal_version: proposal.version,
        proposal_digest: proposal.digest,
        task_key: proposal.currentTaskKey,
        task_round: proposal.currentTaskRound,
      },
      comment: "Reviewed original",
    },
  }
  expect((await f.request(`${path}/approve`, decision)).status).toBe(403)
  const approved = await f.request(`${path}/approve`, {
    ...decision,
    accountId: f.reviewer.accountId,
  })
  if (approved.status !== 200)
    throw new Error(`approval failed: ${approved.status} ${await approved.text()}`)
  expect(await approved.json()).toEqual({ status: "approved" })
  expect(
    (await f.request(`${path}/approve`, { ...decision, accountId: f.reviewer.accountId })).status,
  ).toBe(200)
  const command = { body: { proposal_digest: proposal.digest } }
  expect(
    (await f.request(`${path}/execute`, { ...command, accountId: f.reviewer.accountId })).status,
  ).toBe(403)
  const results = await Promise.all([
    f.request(`${path}/execute`, command),
    f.request(`${path}/execute`, command),
  ])
  for (const result of results) {
    if (result.status !== 200)
      throw new Error(`execution failed: ${result.status} ${await result.text()}`)
  }
  const finalized = await results[0]?.json()
  expect(finalized).toMatchObject({ record_id: receipt.record_id })
  expect(await results[1]?.json()).toEqual(finalized)
  const finished = await query.findByNumber(receipt.number)
  if (finished === null || finished instanceof Error) throw new Error("missing proposal")
  expect(finished.status).toBe("executed")
  expect(
    (await f.request(`${path}/approve`, { ...decision, accountId: f.reviewer.accountId })).status,
  ).toBe(200)
  expect(
    (await f.request(`${path}/reject`, { ...decision, accountId: f.reviewer.accountId })).status,
  ).toBe(409)
})
