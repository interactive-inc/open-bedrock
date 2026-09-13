import { expect, spyOn, test } from "bun:test"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { z } from "zod"
import { createLicensePreservationFixture } from "@/contexts/software-license/test/create-license-preservation-fixture.test-support"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"

test("申請者の取り下げは提案と原文を残し、その後の判断・保全実行を拒否する", async () => {
  const fixture = await createLicensePreservationFixture()
  await fixture.f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
  )
  const submitted = await fixture.f.request(fixture.path, fixture.command)
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), case_id: z.string() })
    .parse(await submitted.json())
  const reader = new SystemD1ProposalAdapter({ env: { DB: fixture.f.database } })
  const proposal = await reader.findByNumber(receipt.number)
  if (proposal === null || proposal instanceof Error) throw new Error("missing proposal")
  const path = `${fixture.path}/${receipt.number}/withdraw`
  const body = { proposal_digest: proposal.digest, reason: "Source requires correction" }
  expect(
    (await fixture.f.request(path, { method: "POST", body, accountId: fixture.reviewer.accountId }))
      .status,
  ).toBe(403)
  expect(
    (
      await fixture.f.request(path, {
        method: "POST",
        body: { ...body, proposal_digest: "0".repeat(64) },
      })
    ).status,
  ).toBe(409)
  expect((await fixture.f.request(path, { method: "POST", body })).status).toBe(200)
  expect((await fixture.f.request(path, { method: "POST", body })).status).toBe(409)
  expect(
    (
      await fixture.f.request(`${fixture.path}/${receipt.number}/approve`, {
        method: "POST",
        accountId: fixture.reviewer.accountId,
        body: {
          comment: null,
          decision_target: {
            proposal_version: proposal.version,
            proposal_digest: proposal.digest,
            task_key: proposal.currentTaskKey,
            task_round: proposal.currentTaskRound,
          },
        },
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await fixture.f.request(`${fixture.path}/${receipt.number}/execute`, {
        method: "POST",
        body: { proposal_digest: proposal.digest },
      })
    ).status,
  ).toBe(409)
  const cancelled = await reader.findByNumber(receipt.number)
  expect(cancelled).toMatchObject({
    status: "cancelled",
    bodyJson: proposal.bodyJson,
    digest: proposal.digest,
  })
  expect(fixture.bucket.size()).toBe(1)
  expect(
    await fixture.f.database
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action='system.record.preservation.withdrawn'",
      )
      .first<number>("count"),
  ).toBe(1)
  expect(
    await fixture.f.database
      .prepare("SELECT count(*) AS count FROM system_preserved_records")
      .first<number>("count"),
  ).toBe(0)
})

test.each(["approve", "withdraw"])(
  "保全の承認と取り下げの競合では先に確定した判断だけを残す: %s",
  async (winner) => {
    const fixture = await createLicensePreservationFixture()
    await fixture.f.database.exec(
      "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
    )
    const submitted = await fixture.f.request(fixture.path, fixture.command)
    expect(submitted.status).toBe(201)
    const receipt = z
      .object({ number: z.number(), case_id: z.string() })
      .parse(await submitted.json())
    const reader = new SystemD1ProposalAdapter({ env: { DB: fixture.f.database } })
    const proposal = await reader.findByNumber(receipt.number)
    if (proposal === null || proposal instanceof Error) throw new Error("missing proposal")
    const withdraw = () =>
      fixture.f.request(`${fixture.path}/${receipt.number}/withdraw`, {
        method: "POST",
        body: { proposal_digest: proposal.digest, reason: "Withdraw current request" },
      })
    const approve = () =>
      fixture.f.request(`${fixture.path}/${receipt.number}/approve`, {
        method: "POST",
        accountId: fixture.reviewer.accountId,
        body: {
          comment: null,
          decision_target: {
            proposal_version: proposal.version,
            proposal_digest: proposal.digest,
            task_key: proposal.currentTaskKey,
            task_round: proposal.currentTaskRound,
          },
        },
      })
    if (winner === "approve") {
      const interception = spyOn(
        SystemD1WorkflowAdapter.prototype,
        "cancel",
      ).mockImplementationOnce(async function (this: SystemD1WorkflowAdapter, input) {
        interception.mockRestore()
        expect((await approve()).status).toBe(200)
        return this.cancel(input)
      })
      try {
        expect((await withdraw()).status).toBe(409)
      } finally {
        interception.mockRestore()
      }
    } else {
      const interception = spyOn(
        SystemD1WorkflowAdapter.prototype,
        "decide",
      ).mockImplementationOnce(async function (this: SystemD1WorkflowAdapter, input) {
        interception.mockRestore()
        expect((await withdraw()).status).toBe(200)
        return this.decide(input)
      })
      try {
        expect((await approve()).status).toBe(409)
      } finally {
        interception.mockRestore()
      }
    }
    expect(await reader.findByNumber(receipt.number)).toMatchObject({
      status: winner === "approve" ? "approved" : "cancelled",
    })
    expect(
      await fixture.f.database
        .prepare("SELECT count(*) AS count FROM system_human_attestations WHERE case_id=?1")
        .bind(receipt.case_id)
        .first<number>("count"),
    ).toBe(winner === "approve" ? 1 : 0)
    expect(
      await fixture.f.database
        .prepare(
          "SELECT count(*) AS count FROM system_audit_events WHERE action='system.record.preservation.withdrawn'",
        )
        .first<number>("count"),
    ).toBe(winner === "withdraw" ? 1 : 0)
    expect(
      await fixture.f.database
        .prepare("SELECT count(*) AS count FROM system_execution_authorizations")
        .first<number>("count"),
    ).toBe(0)
  },
)
