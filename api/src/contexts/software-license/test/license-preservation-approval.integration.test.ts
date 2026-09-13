import { GET as proposalHistory } from "@system/interface/routes/system.proposals.$number.versions.$version"
import { GET as preservedContent } from "@system/interface/routes/system.preserved-records.$recordId.content"
import { GET as preservedRecords } from "@system/interface/routes/system.preserved-records"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { drizzle } from "drizzle-orm/d1"
import { expect, spyOn, test } from "bun:test"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { z } from "zod"
import { createLicensePreservationFixture } from "@/contexts/software-license/test/create-license-preservation-fixture.test-support"

test("会社の承認資格で保全を承認し、両製品共通のHTTP経路で一回だけ実行する", async () => {
  const fixture = await createLicensePreservationFixture()
  await fixture.f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
  )
  const submitted = await fixture.f.request(fixture.path, {
    ...fixture.command,
    body: {
      ...fixture.command.body,
      conditions: {
        ...fixture.conditions,
        disclosure: {
          reason: "Archive access",
          grants: [
            {
              accountId: "account:manager",
              actions: ["read", "export"],
              purposes: ["archive"],
              validFrom: new Date().toISOString(),
              validUntil: null,
            },
          ],
        },
      },
    },
  })
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), case_id: z.string(), record_id: z.string() })
    .parse(await submitted.json())
  const readPath = `${fixture.path}/${receipt.number}`
  const originalReads = spyOn(fixture.bucket, "get")
  expect(
    (await fixture.f.request(readPath, { accountId: fixture.reviewer.accountId })).status,
  ).toBe(403)
  await fixture.f.database.exec(
    "INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('preservation-review-reader','preservation:review-reader','custom','Review reader',0,0); INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('preservation-review-reader','system:procedure:read')",
  )
  await fixture.f.database
    .prepare(
      "INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES ('preservation-review-reader',?1,'preservation-review-reader',0)",
    )
    .bind(fixture.reviewer.accountId)
    .run()
  await fixture.f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:procedure:read')",
  )
  expect((await fixture.f.request(readPath)).status).toBe(403)
  expect(originalReads).toHaveBeenCalledTimes(0)
  const review = await fixture.f.request(`${readPath}?include_original=true`, {
    accountId: fixture.reviewer.accountId,
  })
  if (review.status !== 200)
    throw new Error(`review failed: ${review.status} ${await review.text()}`)
  expect(review.status).toBe(200)
  expect(originalReads).toHaveBeenCalledTimes(1)
  originalReads.mockRestore()
  const proposal = z
    .object({
      decision_target: z.object({
        proposal_version: z.number(),
        proposal_digest: z.string(),
        task_key: z.string(),
        task_round: z.number(),
      }),
      body: z.object({ reason: z.string() }),
      original: z.object({ contentBase64: z.string() }),
    })
    .parse(await review.json())
  expect(proposal.body.reason).toBe(fixture.conditions.reason)
  const preview = z
    .object({ license: z.object({ name: z.string(), plan_name: z.string() }) })
    .parse(JSON.parse(Buffer.from(proposal.original.contentBase64, "base64").toString("utf8")))
  expect(preview.license).toEqual({ name: "Example Service", plan_name: "Team" })

  expect(
    await fixture.f.database
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action='system.proposal.review.read' AND outcome='succeeded'",
      )
      .first<number>("count"),
  ).toBe(1)

  const path = `${readPath}/approve`
  const body = { comment: null, decision_target: proposal.decision_target }
  expect((await fixture.f.request(path, { method: "POST", body })).status).toBe(403)
  const approved = await fixture.f.request(path, {
    method: "POST",
    body,
    accountId: fixture.reviewer.accountId,
  })
  const approval = await approved.json()
  expect({ status: approved.status, body: approval }).toEqual({
    status: 200,
    body: { status: "approved" },
  })
  expect((await fixture.f.request(path, { method: "POST", body })).status).toBe(403)
  expect(
    (await fixture.f.request(path, { method: "POST", body, accountId: fixture.reviewer.accountId }))
      .status,
  ).toBe(200)
  expect(
    await fixture.f.database
      .prepare("SELECT count(*) AS count FROM system_preserved_records")
      .first<number>("count"),
  ).toBe(0)
  const executed = await fixture.f.request(`${fixture.path}/${receipt.number}/execute`, {
    method: "POST",
    body: { proposal_digest: proposal.decision_target.proposal_digest },
  })
  expect(executed.status).toBe(200)
  expect(
    await fixture.f.database
      .prepare("SELECT status FROM system_cases WHERE id=?1")
      .bind(receipt.case_id)
      .first<string>("status"),
  ).toBe("executed")
  await fixture.f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:export'); DROP TABLE software_license_assignments; DROP TABLE software_license_changes; DROP TABLE software_licenses;",
  )
  const core = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => new Date())
      context.set("database", drizzle(fixture.f.database))
      await next()
    })
    .get("/system/preserved-records", ...preservedRecords)
    .get("/system/preserved-records/:recordId/content", ...preservedContent)
    .get("/system/proposals/:number/versions/:version", ...proposalHistory)
  const token = await new SystemAccessTokenIssuer("preservation-isolated-export-test").issue({
    accountId: zAccountId.parse("account:manager"),
    tokenVersion: 0,
    now: new Date(),
  })
  if (token instanceof Error) throw token
  const environment = {
    DB: fixture.f.database,
    JWT_SECRET: "preservation-isolated-export-test",
    ...fixture.f.settings.recordStorage,
  }
  const headers = { authorization: `Bearer ${token}` }
  expect((await core.request(fixture.path, { headers }, environment)).status).toBe(404)
  const searchPath =
    "/system/preserved-records?action=export&purpose=archive&owner_context=software-license"
  const discovered = await core.request(searchPath, { headers }, environment)
  expect(discovered.status).toBe(200)
  expect(discovered.headers.get("cache-control")).toBe("no-store")
  expect(await discovered.json()).toMatchObject({
    records: [
      {
        recordId: receipt.record_id,
        source: { ownerContext: "software-license", sourceRevision: null, sourceRecordedAt: null },
      },
    ],
    nextCursor: null,
  })
  expect((await core.request(searchPath, {}, environment)).status).toBe(401)
  expect(
    (
      await core.request(
        "/system/preserved-records?action=read&purpose=archive",
        { headers },
        environment,
      )
    ).status,
  ).toBe(403)
  expect((await core.request(`${searchPath}&limit=51`, { headers }, environment)).status).toBe(400)
  const wrongPurpose = await core.request(
    "/system/preserved-records?action=export&purpose=unapproved",
    { headers },
    environment,
  )
  expect(wrongPurpose.status).toBe(200)
  const wrongPurposeBody: unknown = await wrongPurpose.json()
  expect(wrongPurposeBody).toEqual({ records: [], nextCursor: null })
  const exported = await core.request(
    `/system/preserved-records/${receipt.record_id}/content?action=export&purpose=archive&format=package`,
    { headers },
    environment,
  )
  expect(exported.status).toBe(200)
  const envelope = z
    .object({ source: z.object({ ownerContext: z.string() }), contentBase64: z.string() })
    .parse(await exported.json())
  expect(envelope.source.ownerContext).toBe("software-license")
  const original = z
    .object({ license: z.object({ name: z.string(), plan_name: z.string() }) })
    .parse(JSON.parse(Buffer.from(envelope.contentBase64, "base64").toString("utf8")))
  expect(original.license).toEqual({ name: "Example Service", plan_name: "Team" })
  const historyPath = `/system/proposals/${receipt.number}/versions/${proposal.decision_target.proposal_version}`
  const history = await core.request(historyPath, { headers }, environment)
  expect(history.status).toBe(200)
  expect(history.headers.get("cache-control")).toBe("no-store")
  const retained = z
    .object({
      digest: z.string(),
      body_json: z.string(),
      case: z.object({ id: z.string(), status: z.string() }),
      procedure_definition: z.object({ completion_operation_key: z.string() }),
      attestations: z.array(z.object({ actorAccountId: z.string(), action: z.string() })),
    })
    .parse(await history.json())
  expect(retained.digest).toBe(proposal.decision_target.proposal_digest)
  expect(retained.case).toEqual({ id: receipt.case_id, status: "executed" })
  expect(retained.procedure_definition.completion_operation_key).toBe("system.record.preserve")
  expect(retained.attestations).toEqual([
    { actorAccountId: fixture.reviewer.accountId, action: "approve" },
  ])
  const intent = z
    .object({ recordId: z.string(), source: z.object({ contentDigest: z.string() }) })
    .parse(JSON.parse(retained.body_json))
  expect(intent.recordId).toBe(receipt.record_id)
  const originalDigest = await crypto.subtle.digest(
    "SHA-256",
    Buffer.from(envelope.contentBase64, "base64"),
  )
  expect(intent.source.contentDigest).toBe(Buffer.from(originalDigest).toString("hex"))

  await fixture.f.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE role_id='license-test-manager' AND permission_key='system:procedure:read'",
  )
  expect((await core.request(historyPath, { headers }, environment)).status).toBe(403)
  expect(
    (
      await core.request(
        `/system/preserved-records/${receipt.record_id}/content?action=export&purpose=archive&format=package`,
        { headers },
        environment,
      )
    ).status,
  ).toBe(200)

  const reviewerToken = await new SystemAccessTokenIssuer(
    "preservation-isolated-export-test",
  ).issue({
    accountId: zAccountId.parse(fixture.reviewer.accountId),
    tokenVersion: 0,
    now: new Date(),
  })
  if (reviewerToken instanceof Error) throw reviewerToken
  const reviewerHeaders = { authorization: `Bearer ${reviewerToken}` }
  expect((await core.request(searchPath, { headers: reviewerHeaders }, environment)).status).toBe(
    403,
  )
  expect((await core.request(historyPath, { headers: reviewerHeaders }, environment)).status).toBe(
    200,
  )
  expect(
    (
      await core.request(
        `/system/preserved-records/${receipt.record_id}/content?action=export&purpose=archive&format=package`,
        { headers: reviewerHeaders },
        environment,
      )
    ).status,
  ).toBe(403)
  await fixture.f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('preservation-review-reader','system:record:export')",
  )
  const qualifiedWithoutDisclosure = await core.request(
    searchPath,
    { headers: reviewerHeaders },
    environment,
  )
  expect(qualifiedWithoutDisclosure.status).toBe(200)
  const qualifiedWithoutDisclosureBody: unknown = await qualifiedWithoutDisclosure.json()
  expect(qualifiedWithoutDisclosureBody).toEqual({ records: [], nextCursor: null })
  await fixture.f.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE role_id='license-test-manager' AND permission_key='system:record:export'",
  )
  expect((await core.request(searchPath, { headers }, environment)).status).toBe(403)
})

test.each(["company", "permission"])(
  "開示監査の直前に資格が取り消されると提案内容も成功監査も返さない: %s",
  async (scenario) => {
    const fixture = await createLicensePreservationFixture()
    await fixture.f.database.exec(
      "INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('license-test-manager','system:record:preserve')",
    )
    const submitted = await fixture.f.request(fixture.path, fixture.command)
    expect(submitted.status).toBe(201)
    const receipt = z.object({ number: z.number() }).parse(await submitted.json())
    await fixture.f.database.exec(
      "INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('review-reader','preservation:review-reader','custom','Review reader',0,0); INSERT INTO system_iam_role_permissions(role_id,permission_key) VALUES ('review-reader','system:procedure:read')",
    )
    await fixture.f.database
      .prepare(
        "INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES ('review-reader',?1,'review-reader',0)",
      )
      .bind(fixture.reviewer.accountId)
      .run()
    const interception = spyOn(
      SystemAuditEventRepository.prototype,
      "append",
    ).mockImplementationOnce(
      async function (this: SystemAuditEventRepository, record, assertions, completionAssertions) {
        interception.mockRestore()
        expect(record.action).toBe("system.proposal.review.read")
        if (scenario === "company") {
          const assignment = fixture.governance.resources.find(
            (resource) => resource.type === "responsibility-assignment",
          )
          if (!assignment) throw new Error("missing responsibility assignment")
          await fixture.governance.write([{ ...assignment, revision: 3, state: "void" }])
        } else {
          await fixture.f.database.exec(
            "DELETE FROM system_iam_role_permissions WHERE role_id='review-reader'",
          )
        }
        return this.append(record, assertions, completionAssertions)
      },
    )
    try {
      const response = await fixture.f.request(
        `${fixture.path}/${receipt.number}?include_original=true`,
        {
          accountId: fixture.reviewer.accountId,
        },
      )
      expect(response.status).toBe(409)
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(await response.text()).not.toContain(fixture.conditions.reason)
    } finally {
      interception.mockRestore()
    }
    expect(
      await fixture.f.database
        .prepare(
          "SELECT count(*) AS count FROM system_audit_events WHERE action='system.proposal.review.read'",
        )
        .first<number>("count"),
    ).toBe(0)
  },
)
