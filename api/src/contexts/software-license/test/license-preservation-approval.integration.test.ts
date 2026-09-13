import { GET as proposalHistory } from "@system/interface/routes/system.proposals.$number.versions.$version"
import { GET as preservedContent } from "@system/interface/routes/system.preserved-records.$recordId.content"
import { GET as preservedRecords } from "@system/interface/routes/system.preserved-records"
import { FindPreservedRecordExecutionProofAdapter } from "@system/infrastructure/adapters/records/find-preserved-record-execution-proof.adapter"
import { PreparePreservedRecordApprovalHistoryAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-approval-history.adapter"
import { PreparePreservedRecordRetentionHistoryAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-retention-history.adapter"
import { PreservedRecordRepository } from "@system/infrastructure/repositories/records/preserved-record.repository"
import { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { PreparePreservedRecordAuditReceiptsAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-audit-receipts.adapter"
import { SystemAuditDisclosureValue } from "@system/domain/values/audit/system-audit-disclosure.value"
import { SystemAuditDisclosurePolicyEntity } from "@system/domain/entities/system-audit-disclosure-policy.entity"
import { auditDisclosureFieldSchema } from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import { PreparePreservedRecordDossierAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-dossier.adapter"
import { GET as preservedDossier } from "@system/interface/routes/system.preserved-records.$recordId.dossier"
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
    .get("/system/preserved-records/:recordId/dossier", ...preservedDossier)
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
  const dossierPath = `/system/preserved-records/${receipt.record_id}/dossier?purpose=archive`
  expect((await core.request(dossierPath, {}, environment)).status).toBe(401)
  expect((await core.request(dossierPath, { headers }, environment)).status).toBe(403)
  await fixture.f.database.exec(
    "INSERT INTO system_iam_role_permissions(role_id, permission_key) VALUES ('license-test-manager', 'system:admin')",
  )
  const dossierResponse = await core.request(dossierPath, { headers }, environment)
  if (dossierResponse.status !== 200)
    throw new Error(`dossier failed ${dossierResponse.status}: ${await dossierResponse.text()}`)
  expect(dossierResponse.headers.get("cache-control")).toBe("no-store")
  const exportedDossier = z
    .object({
      version: z.literal(1),
      contentBase64: z.string(),
      exportAuditEventId: z.string(),
      execution: z.object({ caseId: z.string() }),
      approval: z.object({
        candidates: z.array(
          z.object({
            accountId: z.string(),
            evidenceContext: z.string(),
            evidenceId: z.string().min(1),
            evidenceVersion: z.string().min(1),
            eligibilityDigest: z.string().length(64),
          }),
        ),
        exclusions: z.array(z.object({ accountId: z.string(), reason: z.string() })),
      }),
      auditReceipts: z.array(z.unknown()),
    })
    .parse(await dossierResponse.json())
  expect(exportedDossier.execution.caseId).toBe(receipt.case_id)
  expect(exportedDossier.approval.candidates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        accountId: fixture.reviewer.accountId,
        evidenceContext: "company",
      }),
    ]),
  )
  expect(exportedDossier.auditReceipts).toHaveLength(3)
  expect(
    JSON.parse(Buffer.from(exportedDossier.contentBase64, "base64").toString("utf8")),
  ).toMatchObject({ license: { name: "Example Service", plan_name: "Team" } })
  expect(
    await fixture.f.database
      .prepare("SELECT action FROM system_audit_events WHERE event_id = ?1")
      .bind(exportedDossier.exportAuditEventId)
      .first<string>("action"),
  ).toBe("system.record.dossier.exported")
  expect(
    (
      await core.request(
        dossierPath.replace("purpose=archive", "purpose=unapproved"),
        { headers },
        environment,
      )
    ).status,
  ).toBe(403)
  const exportAuditFailure = spyOn(
    SystemAuditEventRepository.prototype,
    "append",
  ).mockResolvedValueOnce(new Error("simulated audit failure"))
  try {
    const failedExport = await core.request(dossierPath, { headers }, environment)
    expect(failedExport.status).toBe(503)
    expect(await failedExport.text()).not.toContain("contentBase64")
  } finally {
    exportAuditFailure.mockRestore()
  }
  expect(
    await fixture.f.database
      .prepare(
        "SELECT COUNT(*) AS count FROM system_audit_events WHERE action = 'system.record.dossier.exported'",
      )
      .first<number>("count"),
  ).toBe(1)
  const originalGet = fixture.bucket.get.bind(fixture.bucket)
  const revokeDuringRead = spyOn(fixture.bucket, "get").mockImplementationOnce(async (key) => {
    await fixture.f.database.exec(
      "DELETE FROM system_iam_role_permissions WHERE role_id = 'license-test-manager' AND permission_key = 'system:admin'",
    )
    return originalGet(key)
  })
  try {
    const revokedExport = await core.request(dossierPath, { headers }, environment)
    expect(revokedExport.status).toBe(403)
    expect(await revokedExport.text()).not.toContain("contentBase64")
  } finally {
    revokeDuringRead.mockRestore()
  }
  expect(
    await fixture.f.database
      .prepare(
        "SELECT COUNT(*) AS count FROM system_audit_events WHERE action = 'system.record.dossier.exported'",
      )
      .first<number>("count"),
  ).toBe(1)
  const proof = await new FindPreservedRecordExecutionProofAdapter({
    env: environment,
    assertions: [fixture.f.database.prepare("SELECT 1")],
  }).find(receipt.record_id)
  if (proof === null || proof instanceof Error)
    throw new Error("execution proof missing", { cause: proof })
  expect(proof.props).toMatchObject({
    recordId: receipt.record_id,
    caseId: receipt.case_id,
    proposalDigest: proposal.decision_target.proposal_digest,
    executedByAccountId: "account:manager",
  })
  const approvalReader = new PreparePreservedRecordApprovalHistoryAdapter({ env: environment })
  const approvalInput = {
    proof,
    accountId: "account:manager",
    permissionKeys: new Set(["system:procedure:read"]),
    at: new Date(),
  }
  const approvalHistory = await approvalReader.prepare(approvalInput)
  if (approvalHistory instanceof Error) throw approvalHistory
  expect(approvalHistory.proposal.proposalId).toBe(proof.props.proposalId)
  expect(approvalHistory.attestations).toMatchObject([
    {
      actorAccountId: fixture.reviewer.accountId,
      action: "approve",
      proposalDigest: proof.props.proposalDigest,
    },
  ])
  expect(
    await approvalReader.prepare({
      ...approvalInput,
      permissionKeys: new Set(["system:record:export"]),
    }),
  ).toBeInstanceOf(Error)
  expect(
    await approvalReader.prepare({ ...approvalInput, accountId: "unrelated-reader" }),
  ).toBeInstanceOf(Error)
  expect(
    await approvalReader.prepare({ ...approvalInput, accountId: fixture.reviewer.accountId }),
  ).not.toBeInstanceOf(Error)
  expect(
    await approvalReader.prepare({
      ...approvalInput,
      accountId: "unrelated-reader",
      permissionKeys: new Set(["system:procedure:read", "system:procedure:read:all"]),
    }),
  ).not.toBeInstanceOf(Error)
  await fixture.f.database.batch([approvalHistory.guard(new Date())])
  const retentionContext = {
    env: environment,
    assertions: [fixture.f.database.prepare("SELECT 1")],
  }
  const storedRecord = await new PreservedRecordRepository(retentionContext).find(receipt.record_id)
  if (storedRecord === null || storedRecord instanceof Error) throw new Error("record missing")
  const retentionReader = new PreparePreservedRecordRetentionHistoryAdapter(retentionContext)
  const retentionHistory = await retentionReader.prepare(storedRecord)
  if (retentionHistory instanceof Error) throw retentionHistory
  expect(retentionHistory.preservations).toHaveLength(1)
  expect(retentionHistory.preservations[0]?.release).toBeNull()
  await fixture.f.database.batch([retentionHistory.guard])
  expect(
    await new PreparePreservedRecordRetentionHistoryAdapter({
      env: environment,
      assertions: [],
    }).prepare(storedRecord),
  ).toBeInstanceOf(Error)
  const holdRepository = new AttachmentPreservationRepository(retentionContext)
  const originalHold = await holdRepository.find(storedRecord.snapshot.preservationId)
  if (originalHold === null || originalHold instanceof Error) throw new Error("hold missing")
  const releasedHold = originalHold.release({
    operationId: crypto.randomUUID(),
    actorAccountId: "account:manager",
    at: new Date().toISOString(),
    reason: "Release after archive review",
    auditEventId: crypto.randomUUID(),
  })
  if (releasedHold instanceof Error) throw releasedHold
  const releaseAudit = releasedHold.audit(originalHold)
  if (releaseAudit instanceof Error) throw releaseAudit
  expect(await holdRepository.write(releasedHold, releaseAudit)).toBe("written")
  const changedRetention = await fixture.f.database.batch([retentionHistory.guard]).then(
    () => null,
    (cause: unknown) => cause,
  )
  expect(changedRetention).toBeInstanceOf(Error)
  const releasedHistory = await retentionReader.prepare(storedRecord)
  if (releasedHistory instanceof Error) throw releasedHistory
  expect(releasedHistory.preservations[0]).toEqual(releasedHold.snapshot)
  await fixture.f.database.batch([releasedHistory.guard])
  for (const index of Array.from({ length: 100 }, (_, index) => index)) {
    const additionalHold = AttachmentPreservationEntity.create({
      ...originalHold.snapshot,
      id: crypto.randomUUID(),
      reason: `Additional retention ${index}`,
      createdAt: new Date().toISOString(),
      auditEventId: crypto.randomUUID(),
    })
    if (additionalHold instanceof Error) throw additionalHold
    const additionalAudit = additionalHold.audit(null)
    if (additionalAudit instanceof Error) throw additionalAudit
    const written = await holdRepository.write(additionalHold, additionalAudit)
    if (written !== "written") throw new Error("additional hold failed", { cause: written })
  }
  const addedRetention = await fixture.f.database.batch([releasedHistory.guard]).then(
    () => null,
    (cause: unknown) => cause,
  )
  expect(addedRetention).toBeInstanceOf(Error)
  const completeRetention = await retentionReader.prepare(storedRecord)
  if (completeRetention instanceof Error) throw completeRetention
  expect(completeRetention.preservations).toHaveLength(101)
  expect(new Set(completeRetention.preservations.map((preservation) => preservation.id)).size).toBe(
    101,
  )
  await fixture.f.database.batch([completeRetention.guard])
  const auditValue = SystemAuditDisclosureValue.evaluate({
    policies: [],
    accountId: "account:manager",
    purpose: "archive",
    at: new Date(),
  })
  if (auditValue instanceof Error) throw auditValue
  const auditDisclosure = { value: auditValue, assertions: retentionContext.assertions }
  const auditReader = new PreparePreservedRecordAuditReceiptsAdapter({ env: environment })
  const auditIds = [
    storedRecord.snapshot.auditEventId,
    ...completeRetention.preservations.flatMap((preservation) =>
      preservation.release === null
        ? [preservation.auditEventId]
        : [preservation.auditEventId, preservation.release.auditEventId],
    ),
  ]
  const auditReceipts = await auditReader.prepare(
    [...auditIds, storedRecord.snapshot.auditEventId],
    auditDisclosure,
  )
  if (auditReceipts instanceof Error) throw auditReceipts
  expect(auditReceipts.events).toHaveLength(103)
  expect(new Set(auditReceipts.events.map((event) => event.eventId))).toEqual(new Set(auditIds))
  await fixture.f.database.batch([...auditReceipts.guards])
  const dossierReader = new PreparePreservedRecordDossierAdapter(retentionContext)
  const dossierInput = {
    record: storedRecord,
    accountId: "account:manager",
    permissionKeys: new Set(["system:procedure:read"]),
    at: new Date(),
    auditDisclosure,
  }
  const dossier = await dossierReader.prepare(dossierInput)
  if (dossier instanceof Error) throw dossier
  expect(dossier.history.execution.caseId).toBe(receipt.case_id)
  expect(dossier.history.preservations).toHaveLength(101)
  expect(dossier.history.disclosurePolicies).toHaveLength(1)
  expect(dossier.history.auditReceipts).toHaveLength(104)
  await fixture.f.database.batch(dossier.guards(new Date()))
  expect(
    await dossierReader.prepare({
      ...dossierInput,
      permissionKeys: new Set(["system:record:export"]),
    }),
  ).toBeInstanceOf(Error)
  expect(
    await auditReader.prepare([...auditIds, crypto.randomUUID()], auditDisclosure),
  ).toBeInstanceOf(Error)
  expect(
    await auditReader.prepare(auditIds, { ...auditDisclosure, assertions: [] }),
  ).toBeInstanceOf(Error)
  for (const restrictions of [
    {
      allowedFields: auditDisclosureFieldSchema.options.filter(
        (field) => field !== "actor_account_id",
      ),
      allowedTargetTypes: null,
    },
    {
      allowedFields: auditDisclosureFieldSchema.options,
      allowedTargetTypes: ["system:preserved-record"],
    },
  ]) {
    const restrictedPolicy = SystemAuditDisclosurePolicyEntity.create({
      scope: "account:manager",
      commandId: crypto.randomUUID(),
      revision: 1,
      enabled: true,
      ...restrictions,
      allowedPurposes: ["archive"],
      expiresAt: null,
      reason: "Restrict archive disclosure",
      actorAccountId: "account:manager",
      recordedAt: new Date().toISOString(),
      auditEventId: crypto.randomUUID(),
    })
    if (restrictedPolicy instanceof Error) throw restrictedPolicy
    const restrictedValue = SystemAuditDisclosureValue.evaluate({
      policies: [restrictedPolicy],
      accountId: "account:manager",
      purpose: "archive",
      at: new Date(),
    })
    if (restrictedValue instanceof Error) throw restrictedValue
    expect(
      await auditReader.prepare(auditIds, { ...auditDisclosure, value: restrictedValue }),
    ).toBeInstanceOf(Error)
  }
  expect(
    await new FindPreservedRecordExecutionProofAdapter(retentionContext).find(receipt.record_id),
  ).not.toBeInstanceOf(Error)
  expect(
    await new FindPreservedRecordExecutionProofAdapter({
      env: environment,
      assertions: [],
    }).find(receipt.record_id),
  ).toBeInstanceOf(Error)
  expect(
    await new FindPreservedRecordExecutionProofAdapter({
      env: environment,
      assertions: [fixture.f.database.prepare("SELECT json_extract('', '$')")],
    }).find(receipt.record_id),
  ).toBeInstanceOf(Error)
  expect(
    await new FindPreservedRecordExecutionProofAdapter({
      env: environment,
      assertions: [fixture.f.database.prepare("SELECT 1")],
    }).find(crypto.randomUUID()),
  ).toBeNull()
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
  /** 移入済みDBの欠損を再現し、本文が残っていても承認との対応を推測しない。 */
  await fixture.f.database.exec("DROP TRIGGER system_decision_tasks_monotonic_lifecycle")
  await fixture.f.database
    .prepare("UPDATE system_decision_tasks SET required_approvals=2 WHERE case_id=?1")
    .bind(receipt.case_id)
    .run()
  expect(
    await fixture.f.database.batch([approvalHistory.tasksGuard]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(await approvalReader.prepare(approvalInput)).toBeInstanceOf(Error)
  await fixture.f.database
    .prepare("UPDATE system_decision_tasks SET required_approvals=1 WHERE case_id=?1")
    .bind(receipt.case_id)
    .run()
  await fixture.f.database.batch([approvalHistory.tasksGuard])
  await fixture.f.database.exec(
    "DROP TRIGGER system_human_attestations_prevent_delete; DROP TRIGGER system_human_attestations_valid_insert; CREATE TEMP TABLE preserved_test_attestations AS SELECT * FROM system_human_attestations;",
  )
  await fixture.f.database
    .prepare("DELETE FROM system_human_attestations WHERE case_id=?1")
    .bind(receipt.case_id)
    .run()
  expect(await approvalReader.prepare(approvalInput)).toBeInstanceOf(Error)
  await fixture.f.database
    .prepare(
      "INSERT INTO system_human_attestations SELECT * FROM preserved_test_attestations WHERE case_id=?1",
    )
    .bind(receipt.case_id)
    .run()
  await fixture.f.database.exec("DROP TRIGGER system_decision_task_candidates_prevent_update")
  const candidateEvidence = approvalHistory.candidates.find(
    (candidate) => candidate.accountId === fixture.reviewer.accountId,
  )
  if (candidateEvidence === undefined) throw new Error("candidate evidence missing")
  await fixture.f.database
    .prepare(
      "UPDATE system_decision_task_candidates SET evidence_version = 'changed' WHERE case_id = ?1 AND candidate_account_id = ?2",
    )
    .bind(receipt.case_id, fixture.reviewer.accountId)
    .run()
  expect(
    await fixture.f.database
      .batch([approvalHistory.candidatesGuard])
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  await fixture.f.database
    .prepare(
      "UPDATE system_decision_task_candidates SET evidence_version = ?1 WHERE case_id = ?2 AND candidate_account_id = ?3",
    )
    .bind(candidateEvidence.evidenceVersion, receipt.case_id, fixture.reviewer.accountId)
    .run()
  await fixture.f.database.batch([approvalHistory.candidatesGuard])
  await fixture.f.database.exec("DROP TRIGGER system_decision_task_candidates_prevent_delete")
  await fixture.f.database.exec("DROP TRIGGER system_decision_task_candidates_valid_insert")
  await fixture.f.database.exec(
    "CREATE TEMP TABLE preserved_test_candidates AS SELECT * FROM system_decision_task_candidates",
  )
  await fixture.f.database
    .prepare(
      "DELETE FROM system_decision_task_candidates WHERE case_id = ?1 AND candidate_account_id = ?2",
    )
    .bind(receipt.case_id, fixture.reviewer.accountId)
    .run()
  expect(await approvalReader.prepare(approvalInput)).toBeInstanceOf(Error)
  await fixture.f.database
    .prepare(
      "INSERT INTO system_decision_task_candidates SELECT * FROM preserved_test_candidates WHERE case_id = ?1 AND candidate_account_id = ?2",
    )
    .bind(receipt.case_id, fixture.reviewer.accountId)
    .run()
  await fixture.f.database.batch([approvalHistory.candidatesGuard])
  const excludedHistory = await approvalReader.prepare(approvalInput)
  if (excludedHistory instanceof Error) throw excludedHistory
  expect(excludedHistory.exclusions).toContainEqual({
    taskKey: candidateEvidence.taskKey,
    round: candidateEvidence.round,
    accountId: zAccountId.parse("account:manager"),
    reason: "creator",
  })
  await fixture.f.database.batch([excludedHistory.candidatesGuard])
  await fixture.f.database.exec("DROP TRIGGER system_decision_task_exclusions_prevent_update")
  await fixture.f.database
    .prepare(
      "UPDATE system_decision_task_exclusions SET reason='policy' WHERE case_id=?1 AND excluded_account_id=?2",
    )
    .bind(receipt.case_id, "account:manager")
    .run()
  expect(
    await fixture.f.database
      .batch([excludedHistory.candidatesGuard])
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  await fixture.f.database.exec("DROP TRIGGER system_human_attestations_prevent_update")
  await fixture.f.database
    .prepare("UPDATE system_human_attestations SET proposal_digest = ?1 WHERE case_id = ?2")
    .bind("f".repeat(64), receipt.case_id)
    .run()
  expect(await approvalReader.prepare(approvalInput)).toBeInstanceOf(Error)
  expect(
    await fixture.f.database
      .batch([approvalHistory.attestationsGuard])
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  await fixture.f.database
    .prepare(
      "UPDATE system_human_attestations SET proposal_digest = ?1, comment = 'changed after read' WHERE case_id = ?2",
    )
    .bind(proof.props.proposalDigest, receipt.case_id)
    .run()
  expect(
    await fixture.f.database
      .batch([approvalHistory.attestationsGuard])
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  await fixture.f.database.exec("DROP TRIGGER system_proposal_cases_prevent_delete")
  await fixture.f.database
    .prepare("DELETE FROM system_proposal_cases WHERE case_id = ?1")
    .bind(receipt.case_id)
    .run()
  const missingLink = await new FindPreservedRecordExecutionProofAdapter({
    env: environment,
    assertions: [fixture.f.database.prepare("SELECT 1")],
  }).find(receipt.record_id)
  expect(missingLink).toBeInstanceOf(Error)
  expect(
    await fixture.f.database.batch(dossier.guards(new Date())).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(await dossierReader.prepare(dossierInput)).toBeInstanceOf(Error)
  const changedApproval = await fixture.f.database.batch([approvalHistory.guard(new Date())]).then(
    () => null,
    (cause: unknown) => cause,
  )
  expect(changedApproval).toBeInstanceOf(Error)
  expect(await approvalReader.prepare(approvalInput)).toBeInstanceOf(Error)
  await fixture.f.database
    .prepare(`INSERT INTO system_cases
    (id, subject_context, subject_kind, subject_id, subject_version, proposal_digest,
     created_by_account_id, status, created_at, updated_at)
    SELECT 'duplicate-executed-case', subject_context, subject_kind, subject_id, subject_version,
      proposal_digest, created_by_account_id, status, created_at, updated_at
    FROM system_cases WHERE id = ?1`)
    .bind(receipt.case_id)
    .run()
  const ambiguous = await new FindPreservedRecordExecutionProofAdapter({
    env: environment,
    assertions: [fixture.f.database.prepare("SELECT 1")],
  }).find(receipt.record_id)
  expect(ambiguous).toBeInstanceOf(Error)
  if (ambiguous instanceof Error)
    expect(ambiguous.message).toBe("record execution proof is ambiguous")
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
