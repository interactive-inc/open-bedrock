import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { expect, spyOn, test } from "bun:test"
import { z } from "zod"
import { createLicensePreservationFixture } from "@/contexts/software-license/test/create-license-preservation-fixture.test-support"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"

test("次段階へ進んだ後も同じ承認を再送でき、次段階の票は増えない", async () => {
  const fixture = await createLicensePreservationFixture("reject", true)
  await fixture.f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
  )
  const submitted = await fixture.f.request(fixture.path, fixture.command)
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), case_id: z.string() })
    .parse(await submitted.json())
  const query = new SystemD1ProposalAdapter({ env: { DB: fixture.f.database } })
  const proposal = await query.findByNumber(receipt.number)
  if (proposal === null || proposal instanceof Error || proposal.currentTaskKey === null)
    throw new Error("proposal missing")
  const body = {
    comment: "First review",
    decision_target: {
      proposal_version: proposal.version,
      proposal_digest: proposal.digest,
      task_key: proposal.currentTaskKey,
      task_round: proposal.currentTaskRound,
    },
  }
  const path = `${fixture.path}/${receipt.number}/approve`
  const first = await fixture.f.request(path, {
    method: "POST",
    body,
    accountId: fixture.reviewer.accountId,
  })
  expect(first.status).toBe(200)
  expect(z.object({ status: z.string() }).parse(await first.json())).toEqual({ status: "pending" })
  const replay = await fixture.f.request(path, {
    method: "POST",
    body,
    accountId: fixture.reviewer.accountId,
  })
  expect(replay.status).toBe(200)
  expect(z.object({ status: z.string() }).parse(await replay.json())).toEqual({ status: "pending" })
  const changed = await fixture.f.request(path, {
    method: "POST",
    body: { ...body, comment: "Different review" },
    accountId: fixture.reviewer.accountId,
  })
  expect(changed.status).toBe(409)
  const next = await query.findByNumber(receipt.number)
  if (next === null || next instanceof Error) throw new Error("proposal missing")
  expect(next.currentTaskKey).toBe("second-review")
  const attestations = await query.listAttestations(receipt.case_id)
  if (attestations instanceof Error) throw attestations
  expect(attestations).toHaveLength(1)
  expect(attestations[0]?.taskKey).toBe(proposal.currentTaskKey)
  const approveSecond = () =>
    fixture.f.request(path, {
      method: "POST",
      body: {
        comment: "Second review",
        decision_target: {
          proposal_version: next.version,
          proposal_digest: next.digest,
          task_key: next.currentTaskKey,
          task_round: next.currentTaskRound,
        },
      },
      accountId: fixture.reviewer.accountId,
    })
  const interception = spyOn(
    PrepareSystemCaseReadGuardAdapter.prototype,
    "prepare",
  ).mockImplementationOnce(async function (this: PrepareSystemCaseReadGuardAdapter, input) {
    interception.mockRestore()
    const guard = await this.prepare(input)
    const second = await approveSecond()
    expect(second.status).toBe(200)
    expect(z.object({ status: z.string() }).parse(await second.json())).toEqual({
      status: "approved",
    })
    return guard
  })
  try {
    const raced = await fixture.f.request(path, {
      method: "POST",
      body,
      accountId: fixture.reviewer.accountId,
    })
    expect(raced.status).toBe(409)
  } finally {
    interception.mockRestore()
  }
  const finishedReplay = await fixture.f.request(path, {
    method: "POST",
    body,
    accountId: fixture.reviewer.accountId,
  })
  expect(finishedReplay.status).toBe(200)
  expect(z.object({ status: z.string() }).parse(await finishedReplay.json())).toEqual({
    status: "approved",
  })
  const completed = await query.listAttestations(receipt.case_id)
  if (completed instanceof Error) throw completed
  expect(completed).toHaveLength(2)
})
