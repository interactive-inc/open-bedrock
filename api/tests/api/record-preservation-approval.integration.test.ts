import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { expect, test } from "bun:test"
import { z } from "zod"
import { createLicensePreservationFixture } from "@/contexts/software-license/test/create-license-preservation-fixture.test-support"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { createTestToken } from "@tests/api/support/create-test-token"
import { withCurrentDecisionTarget } from "@tests/api/support/with-current-decision-target"

test("保全申請は会社の資格で承認でき、承認だけでは保全を実行しない", async () => {
  const fixture = await createLicensePreservationFixture()
  await fixture.f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
  )
  const submitted = await fixture.f.request(fixture.path, fixture.command)
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), case_id: z.string() })
    .parse(await submitted.json())
  const path = `/company/application-requests/${receipt.number}/approve`
  const unqualified = fixture.governance.people.find(
    (person) => person.accountId !== fixture.reviewer.accountId,
  )
  if (!unqualified) throw new Error("missing unqualified actor")
  const denied = await requestWithContext({
    db: fixture.f.database,
    jwtSecret: "record-preservation-approval-test",
    path,
    method: "POST",
    body: await withCurrentDecisionTarget(fixture.f.database, path, { comment: null }),
    now: new Date().toISOString(),
    token: await createTestToken("record-preservation-approval-test", {
      employeeId: unqualified.employeeId,
      accountId: unqualified.accountId,
    }),
  })
  expect(denied.status).toBe(403)
  const approved = await requestWithContext({
    db: fixture.f.database,
    jwtSecret: "record-preservation-approval-test",
    path,
    method: "POST",
    body: await withCurrentDecisionTarget(fixture.f.database, path, { comment: null }),
    now: new Date().toISOString(),
    token: await createTestToken("record-preservation-approval-test", {
      employeeId: fixture.reviewer.employeeId,
      accountId: fixture.reviewer.accountId,
    }),
  })
  const approval = await approved.json()
  expect({ status: approved.status, body: approval }).toEqual({
    status: 200,
    body: { status: "approved" },
  })
  const replayApproved = await requestWithContext({
    db: fixture.f.database,
    jwtSecret: "record-preservation-approval-test",
    path,
    method: "POST",
    body: await withCurrentDecisionTarget(fixture.f.database, path, { comment: null }),
    now: new Date().toISOString(),
    token: await createTestToken("record-preservation-approval-test", {
      employeeId: fixture.reviewer.employeeId,
      accountId: fixture.reviewer.accountId,
    }),
  })
  expect(replayApproved.status).toBe(200)
  const replayDenied = await requestWithContext({
    db: fixture.f.database,
    jwtSecret: "record-preservation-approval-test",
    path,
    method: "POST",
    body: await withCurrentDecisionTarget(fixture.f.database, path, { comment: null }),
    now: new Date().toISOString(),
    token: await createTestToken("record-preservation-approval-test", {
      employeeId: unqualified.employeeId,
      accountId: unqualified.accountId,
    }),
  })
  expect(replayDenied.status).toBe(403)
  expect(
    await fixture.f.database
      .prepare("SELECT status FROM system_cases WHERE id = ?")
      .bind(receipt.case_id)
      .first<string>("status"),
  ).toBe("approved")
  expect(
    await fixture.f.database
      .prepare("SELECT count(*) AS count FROM system_preserved_records")
      .first<number>("count"),
  ).toBe(0)
  expect(
    await fixture.f.database
      .prepare(
        "SELECT count(*) AS count FROM system_execution_authorizations WHERE used_at IS NOT NULL",
      )
      .first<number>("count"),
  ).toBe(0)
  const proposal = await new SystemD1ProposalAdapter({
    env: { DB: fixture.f.database },
  }).findByNumber(receipt.number)
  if (proposal === null || proposal instanceof Error) throw new Error("missing proposal")
  const digest = proposal.digest
  const executionPath = `${fixture.path}/${receipt.number}/execute`
  const attempts = await Promise.all([
    fixture.f.request(executionPath, { method: "POST", body: { proposal_digest: digest } }),
    fixture.f.request(executionPath, { method: "POST", body: { proposal_digest: digest } }),
  ])
  const executed = attempts[0]
  const concurrent = attempts[1]
  if (executed === undefined || concurrent === undefined)
    throw new Error("missing execution response")
  const executionReceipt = await executed.json()
  expect({ status: executed.status, body: executionReceipt }).toMatchObject({ status: 200 })
  expect(concurrent.status).toBe(200)
  expect(await concurrent.json()).toEqual(executionReceipt)
  const executionReplay = await fixture.f.request(executionPath, {
    method: "POST",
    body: { proposal_digest: digest },
  })
  expect(executionReplay.status).toBe(200)
  expect(await executionReplay.json()).toEqual(executionReceipt)
  expect(
    await fixture.f.database
      .prepare("SELECT status FROM system_cases WHERE id = ?")
      .bind(receipt.case_id)
      .first<string>("status"),
  ).toBe("executed")
  expect(
    await fixture.f.database
      .prepare("SELECT count(*) AS count FROM system_preserved_records")
      .first<number>("count"),
  ).toBe(1)
})

test("保全申請の提出後に承認責務を取り消すと承認と証跡の追加を拒否する", async () => {
  const fixture = await createLicensePreservationFixture()
  await fixture.f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
  )
  const submitted = await fixture.f.request(fixture.path, fixture.command)
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), case_id: z.string() })
    .parse(await submitted.json())
  const assignment = fixture.governance.resources.find(
    (resource) => resource.type === "responsibility-assignment",
  )
  if (!assignment) throw new Error("missing responsibility assignment")
  await fixture.governance.write([{ ...assignment, revision: 3, state: "void" }])
  const path = `/company/application-requests/${receipt.number}/approve`
  const denied = await requestWithContext({
    db: fixture.f.database,
    jwtSecret: "record-preservation-approval-test",
    path,
    method: "POST",
    body: await withCurrentDecisionTarget(fixture.f.database, path, { comment: null }),
    now: new Date().toISOString(),
    token: await createTestToken("record-preservation-approval-test", {
      employeeId: fixture.reviewer.employeeId,
      accountId: fixture.reviewer.accountId,
    }),
  })
  expect(denied.status).toBe(403)
  expect(
    await fixture.f.database
      .prepare("SELECT status FROM system_cases WHERE id = ?")
      .bind(receipt.case_id)
      .first<string>("status"),
  ).toBe("pending")
  expect(
    await fixture.f.database
      .prepare("SELECT count(*) AS count FROM system_human_attestations WHERE case_id = ?")
      .bind(receipt.case_id)
      .first<number>("count"),
  ).toBe(0)
})

test.each(["pending", "digest", "permission", "source", "company"])(
  "保全実行は不成立の条件で記録も実行許可も保存しない: %s",
  async (scenario) => {
    const fixture = await createLicensePreservationFixture()
    await fixture.f.database.exec(
      "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
    )
    const submitted = await fixture.f.request(fixture.path, fixture.command)
    expect(submitted.status).toBe(201)
    const receipt = z
      .object({ number: z.number(), case_id: z.string() })
      .parse(await submitted.json())
    const proposal = await new SystemD1ProposalAdapter({
      env: { DB: fixture.f.database },
    }).findByNumber(receipt.number)
    if (proposal === null || proposal instanceof Error) throw new Error("missing proposal")
    if (scenario !== "pending") {
      const path = `/company/application-requests/${receipt.number}/approve`
      const approved = await requestWithContext({
        db: fixture.f.database,
        jwtSecret: "record-preservation-approval-test",
        path,
        method: "POST",
        body: await withCurrentDecisionTarget(fixture.f.database, path, { comment: null }),
        now: new Date().toISOString(),
        token: await createTestToken("record-preservation-approval-test", {
          employeeId: fixture.reviewer.employeeId,
          accountId: fixture.reviewer.accountId,
        }),
      })
      expect(approved.status).toBe(200)
    }
    if (scenario === "permission")
      await fixture.f.database.exec(
        "DELETE FROM system_iam_role_permissions WHERE permission_key='system:record:preserve'",
      )
    if (scenario === "source")
      await fixture.f.database
        .prepare("UPDATE software_licenses SET note='Changed after approval' WHERE id=?1")
        .bind(fixture.f.license.id)
        .run()
    if (scenario === "company") {
      const assignment = fixture.governance.resources.find(
        (resource) => resource.type === "responsibility-assignment",
      )
      if (!assignment) throw new Error("missing responsibility assignment")
      await fixture.governance.write([{ ...assignment, revision: 3, state: "void" }])
    }
    const executed = await fixture.f.request(`${fixture.path}/${receipt.number}/execute`, {
      method: "POST",
      body: { proposal_digest: scenario === "digest" ? "0".repeat(64) : proposal.digest },
    })
    expect(executed.status).toBe(scenario === "permission" || scenario === "company" ? 403 : 409)
    expect(
      await fixture.f.database
        .prepare("SELECT count(*) AS count FROM system_preserved_records")
        .first<number>("count"),
    ).toBe(0)
    expect(
      await fixture.f.database
        .prepare("SELECT count(*) AS count FROM system_execution_authorizations")
        .first<number>("count"),
    ).toBe(0)
    expect(
      await fixture.f.database
        .prepare("SELECT status FROM system_cases WHERE id=?1")
        .bind(receipt.case_id)
        .first<string>("status"),
    ).toBe(scenario === "pending" ? "pending" : "approved")
  },
)
