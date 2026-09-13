import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { expect, spyOn, test } from "bun:test"
import { z } from "zod"
import { createLicensePreservationFixture } from "@/contexts/software-license/test/create-license-preservation-fixture.test-support"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { createTestToken } from "@tests/api/support/create-test-token"
import { withCurrentDecisionTarget } from "@tests/api/support/with-current-decision-target"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"

test("共通承認APIでも前段階の同一承認を再送でき、次段階に投票しない", async () => {
  const fixture = await createLicensePreservationFixture("reject", true)
  await fixture.f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
  )
  const submitted = await fixture.f.request(fixture.path, fixture.command)
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), case_id: z.string() })
    .parse(await submitted.json())
  const path = `/company/application-requests/${receipt.number}/approve`
  const body = await withCurrentDecisionTarget(fixture.f.database, path, {
    comment: "First review",
  })
  const token = await createTestToken("preservation-generic-replay-test", {
    employeeId: fixture.reviewer.employeeId,
    accountId: fixture.reviewer.accountId,
  })
  const request = (command: unknown) =>
    requestWithContext({
      db: fixture.f.database,
      jwtSecret: "preservation-generic-replay-test",
      path,
      method: "POST",
      body: command,
      now: new Date().toISOString(),
      token,
    })
  const first = await request(body)
  expect(first.status).toBe(200)
  expect(await first.json()).toEqual({ status: "pending" })
  const replay = await request(body)
  expect(replay.status).toBe(200)
  expect(await replay.json()).toEqual({ status: "pending" })
  const query = new SystemD1ProposalAdapter({ env: { DB: fixture.f.database } })
  const attestations = await query.listAttestations(receipt.case_id)
  if (attestations instanceof Error) throw attestations
  expect(attestations).toHaveLength(1)
  const changed = await request({ ...body, comment: "Different first review" })
  expect(changed.status).toBe(409)
  const nextBody = await withCurrentDecisionTarget(fixture.f.database, path, {
    comment: "Second review",
  })
  const interception = spyOn(
    PrepareSystemCaseReadGuardAdapter.prototype,
    "prepare",
  ).mockImplementationOnce(async function (this: PrepareSystemCaseReadGuardAdapter, input) {
    interception.mockRestore()
    const guard = await this.prepare(input)
    const second = await request(nextBody)
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ status: "approved" })
    return guard
  })
  try {
    const raced = await request(body)
    expect(raced.status).toBe(409)
  } finally {
    interception.mockRestore()
  }
  const finishedReplay = await request(body)
  expect(finishedReplay.status).toBe(200)
  expect(await finishedReplay.json()).toEqual({ status: "approved" })
  const completed = await query.listAttestations(receipt.case_id)
  if (completed instanceof Error) throw completed
  expect(completed).toHaveLength(2)
})

test("共通承認の再送確認中に認証が失効した場合は受付結果を開示しない", async () => {
  const fixture = await createLicensePreservationFixture("reject", true)
  await fixture.f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
  )
  const submitted = await fixture.f.request(fixture.path, fixture.command)
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), case_id: z.string() })
    .parse(await submitted.json())
  const path = `/company/application-requests/${receipt.number}/approve`
  const body = await withCurrentDecisionTarget(fixture.f.database, path, { comment: null })
  const token = await createTestToken("preservation-generic-revocation-test", {
    employeeId: fixture.reviewer.employeeId,
    accountId: fixture.reviewer.accountId,
  })
  const request = () =>
    requestWithContext({
      db: fixture.f.database,
      jwtSecret: "preservation-generic-revocation-test",
      path,
      method: "POST",
      body,
      now: new Date().toISOString(),
      token,
    })
  expect((await request()).status).toBe(200)
  const interception = spyOn(
    PrepareSystemCaseReadGuardAdapter.prototype,
    "prepare",
  ).mockImplementationOnce(async function (this: PrepareSystemCaseReadGuardAdapter, input) {
    interception.mockRestore()
    const guard = await this.prepare(input)
    await fixture.f.database
      .prepare("UPDATE system_accounts SET token_version=token_version+1 WHERE id=?1")
      .bind(fixture.reviewer.accountId)
      .run()
    return guard
  })
  try {
    const raced = await request()
    expect(raced.status).toBe(409)
  } finally {
    interception.mockRestore()
  }
  expect((await request()).status).toBe(401)
  const query = new SystemD1ProposalAdapter({ env: { DB: fixture.f.database } })
  const attestations = await query.listAttestations(receipt.case_id)
  if (attestations instanceof Error) throw attestations
  expect(attestations).toHaveLength(1)
})
