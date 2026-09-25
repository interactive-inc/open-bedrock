import { POST as verifyRetirement } from "@/contexts/attendance/interface/routes/attendance.retirement-plans.$planId.verification-receipts"
import { prepareSystemRecordKindCoverage } from "@system/interface/operations/prepare-system-record-kind-coverage"
import { prepareSystemPreservedRecordRetentionGuard } from "@system/interface/operations/prepare-system-preserved-record-retention-guard"
import { openSystemPreservedRecords } from "@system/interface/operations/open-system-preserved-records"
import { openSystemAttachmentPreservations } from "@system/interface/operations/open-system-attachment-preservations"
import { POST as createRetirementPlan } from "@/contexts/attendance/interface/routes/attendance.record-source-freezes.$freezeId.retirement-plans"
import { POST as verifyCoverage } from "@/contexts/attendance/interface/routes/attendance.record-source-freezes.$freezeId.coverage-pages"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { HTTPException } from "hono/http-exception"
import { ReleaseRecordSourceFreeze } from "@system/application/records/release-record-source-freeze"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { openSystemRecordCoveragePages } from "@system/interface/operations/open-system-record-coverage-pages"
import { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { attendanceFactory } from "@/contexts/attendance/interface/request-environment/attendance-factory"
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { drizzle } from "drizzle-orm/d1"
import { createAttendancePreservationFixture } from "@/contexts/attendance/test/create-attendance-preservation-fixture.test-support"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { CaptureFrozenAttendanceRecordPageAdapter } from "@/contexts/attendance/infrastructure/adapters/capture-frozen-attendance-record-page.adapter"
import { CreateRecordSourceFreeze } from "@system/application/records/create-record-source-freeze"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { verifySystemPreservedRecordSource } from "@system/interface/operations/verify-system-preserved-record-source"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
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

test("人が承認した保全本文を復号・開示監査して停止中の原記録と照合する", async () => {
  const f = await createAttendancePreservationFixture(await pool.next())
  await execSql(
    f.database,
    "INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:record:preserve'),('role:attendance-archive','system:record:read')",
  )
  const now = new Date()
  const creator = f.governance.creator.accountId
  const authentication = {
    accountId: creator,
    tokenVersion: 0,
    issuedAtMs: now.getTime() - 1000,
    expiresAtMs: now.getTime() + 60000,
    machineCredentialId: null,
    identityBindingId: null,
  }
  const env = { DB: f.database, ...f.recordStorage }
  const context = {
    env,
    var: {
      database: drizzle(f.database),
      now: () => new Date(),
      bearerReadAuthentication: authentication,
    },
  }
  const freezeId = crypto.randomUUID()
  await new CreateRecordSourceFreeze({
    repository: openSystemRecordSourceFreezes({ env, assertions: [] }),
  }).execute(
    {
      id: freezeId,
      sourceNamespace: f.settings.sourceNamespace,
      ownerContext: "attendance",
      actorAccountId: creator,
      reason: "Preserve source",
    },
    now,
  )
  const submitted = await f.request(f.path, {
    ...f.command,
    body: {
      procedure_key: f.definition.key,
      conditions: {
        ...f.conditions,
        disclosure: {
          reason: "Archive review",
          grants: [
            {
              accountId: creator,
              actions: ["read"],
              purposes: ["archive"],
              validFrom: now.toISOString(),
              validUntil: null,
            },
          ],
        },
      },
    },
  })
  expect(submitted.status).toBe(201)
  const receipt = z
    .object({ number: z.number(), record_id: z.string() })
    .parse(await submitted.json())
  const proposal = await openSystemProposals({ env }).findByNumber(receipt.number)
  if (proposal === null || proposal instanceof Error) throw new Error("missing proposal")
  const path = `${f.path}/${receipt.number}`
  expect(
    (
      await f.request(`${path}/approve`, {
        accountId: f.reviewer.accountId,
        body: {
          decision_target: {
            proposal_version: proposal.version,
            proposal_digest: proposal.digest,
            task_key: proposal.currentTaskKey,
            task_round: proposal.currentTaskRound,
          },
          comment: "Reviewed source",
        },
      })
    ).status,
  ).toBe(200)
  expect(
    (await f.request(`${path}/execute`, { body: { proposal_digest: proposal.digest } })).status,
  ).toBe(200)
  const page = await new CaptureFrozenAttendanceRecordPageAdapter(context).prepare({
    freezeId,
    sourceNamespace: f.settings.sourceNamespace,
    afterId: 0,
    limit: 10,
  })
  if (page instanceof Error) throw page
  const original = page.records[0]
  if (original === undefined) throw new Error("missing original")
  const verifier = {
    execute: async (request: Parameters<typeof verifySystemPreservedRecordSource>[1]) => {
      const app = attendanceFactory.createApp().get("/verify", async (c) => {
        c.set("database", context.var.database)
        const verified = await verifySystemPreservedRecordSource(
          {
            env: c.env,
            var: c.var,
            now: context.var.now,
            assertions: page.assertions,
          },
          request,
        )
        if (verified instanceof Error) return c.json({ error: "verification_failed" }, 403)
        return c.json(verified)
      })
      const response = await app.request("/verify", {}, env)
      if (response.status !== 200) return new Error("verification failed")
      const body = z
        .object({ recordId: z.string(), source: z.unknown() })
        .parse(await response.json())
      const source = PreservedRecordSourceValue.create(body.source)
      if (source instanceof Error) return source
      return { recordId: body.recordId, source: source.props }
    },
  }
  const input = {
    authentication,
    recordId: receipt.record_id,
    purpose: "archive",
    source: original.source,
  }
  const verified = await verifier.execute(input)
  if (verified instanceof Error) throw verified
  expect(verified.recordId).toBe(receipt.record_id)
  const preservedSource = PreservedRecordSourceValue.create(verified.source)
  if (preservedSource instanceof Error) throw preservedSource
  expect(original.source.matchesSource(preservedSource)).toBe(true)
  expect(Date.parse(verified.source.capturedAt)).toBeLessThanOrEqual(
    Date.parse(original.source.props.capturedAt),
  )
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE action='system.record.disclosed'",
      )
      .first<number>("n"),
  ).toBe(1)
  const pageInput = {
    id: crypto.randomUUID(),
    freezeId,
    sourceNamespace: f.settings.sourceNamespace,
    ownerContext: "attendance",
    recordKind: "attendance-record",
    sequence: 1,
    previousDigest: null,
    afterCursor: null,
    nextCursor: "1",
    purpose: "archive",
    checkedAt: new Date().toISOString(),
    actorAccountId: creator,
    records: [{ preservedRecordId: receipt.record_id, source: verified.source }],
  }
  const coverage = await RecordCoveragePageEntity.create(pageInput, null)
  if (coverage instanceof Error) throw coverage
  const save = async (entry: RecordCoveragePageEntity, before: RecordCoveragePageEntity | null) => {
    const audit = SystemAuditEventEntity.create({
      actorAccountId: creator,
      action: "system.record.coverage.page.verified",
      targetType: "system:record-coverage-page",
      targetId: entry.snapshot.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: before === null ? null : JSON.stringify(before.snapshot),
      afterJson: JSON.stringify(entry.snapshot),
      metadataJson: null,
      occurredAt: new Date(entry.snapshot.checkedAt),
    })
    if (audit instanceof Error) throw audit
    return openSystemRecordCoveragePages({ env, assertions: page.assertions }).append(entry, audit)
  }
  expect(await save(coverage, null)).toBe("written")
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_coverage_entries")
      .first<number>("n"),
  ).toBe(1)
  expect(await save(coverage, null)).toBe("conflict")
  const duplicate = await RecordCoveragePageEntity.create(
    {
      ...pageInput,
      id: crypto.randomUUID(),
      sequence: 2,
      previousDigest: coverage.digest,
      afterCursor: "1",
      nextCursor: null,
    },
    coverage,
  )
  if (duplicate instanceof Error) throw duplicate
  expect(await save(duplicate, coverage)).toBe("conflict")
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_coverage_pages")
      .first<number>("n"),
  ).toBe(1)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE action='system.record.coverage.page.verified'",
      )
      .first<number>("n"),
  ).toBe(1)
  expect(
    await execSql(f.database, "DELETE FROM system_record_coverage_entries").catch(
      (error: unknown) => error,
    ),
  ).toBeInstanceOf(Error)
  const chainVerifierContext = { env, assertions: page.assertions }
  const chainScope = {
    freezeId,
    sourceNamespace: f.settings.sourceNamespace,
    ownerContext: "attendance",
    recordKind: "attendance-record",
    purpose: "archive",
  }
  expect(await prepareSystemRecordKindCoverage(chainVerifierContext, chainScope)).toBeInstanceOf(
    Error,
  )
  const terminal = await RecordCoveragePageEntity.create(
    {
      ...pageInput,
      id: crypto.randomUUID(),
      sequence: 2,
      previousDigest: coverage.digest,
      afterCursor: "1",
      nextCursor: null,
      records: [],
    },
    coverage,
  )
  if (terminal instanceof Error) throw terminal
  expect(await save(terminal, coverage)).toBe("written")
  const chain = await prepareSystemRecordKindCoverage(chainVerifierContext, chainScope)
  if (chain instanceof Error) throw chain
  expect(chain.summary).toMatchObject({
    pageCount: 2,
    recordCount: 1,
    terminalPageId: terminal.snapshot.id,
    terminalDigest: terminal.digest,
  })
  expect(
    await prepareSystemRecordKindCoverage(chainVerifierContext, {
      ...chainScope,
      recordKind: "missing-kind",
    }),
  ).toBeInstanceOf(Error)
  expect(
    await prepareSystemRecordKindCoverage(chainVerifierContext, {
      ...chainScope,
      purpose: "different",
    }),
  ).toBeInstanceOf(Error)
  expect(
    await prepareSystemRecordKindCoverage(chainVerifierContext, {
      ...chainScope,
      sourceNamespace: "other-source",
    }),
  ).toBeInstanceOf(Error)
  expect(await prepareSystemRecordKindCoverage({ env, assertions: [] }, chainScope)).toBeInstanceOf(
    Error,
  )
  expect((await f.database.batch([...chain.assertions])).every((result) => result.success)).toBe(
    true,
  )
  const repository = openSystemRecordCoveragePages({ env, assertions: page.assertions })
  expect(await repository.findLatest({ freezeId, recordKind: "attendance-record" })).toMatchObject({
    digest: terminal.digest,
  })
  expect(await repository.find(coverage.snapshot.id)).toMatchObject({ digest: coverage.digest })
  const denied = openSystemRecordCoveragePages({
    env,
    assertions: [f.database.prepare("SELECT json_extract('{}','denied')")],
  })
  expect(await denied.find(coverage.snapshot.id)).toBeInstanceOf(Error)

  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_coverage_pages")
      .first<number>("n"),
  ).toBe(2)
  const changed = PreservedRecordSourceValue.create({
    ...original.source.props,
    contentDigest: "0".repeat(64),
  })
  if (changed instanceof Error) throw changed
  expect(await verifier.execute({ ...input, source: changed })).toBeInstanceOf(Error)
  expect(await verifier.execute({ ...input, purpose: "ungranted" })).toBeInstanceOf(Error)
  await execSql(
    f.database,
    "DELETE FROM system_iam_role_permissions WHERE permission_key='system:record:read'",
  )
  expect(await verifier.execute(input)).toBeInstanceOf(Error)
  await new ReleaseRecordSourceFreeze({
    repository: openSystemRecordSourceFreezes({ env, assertions: [] }),
  }).execute(
    {
      id: freezeId,
      sourceNamespace: f.settings.sourceNamespace,
      ownerContext: "attendance",
      actorAccountId: creator,
      reason: "Restart verification",
    },
    new Date(),
  )
  await execSql(f.database, "CREATE TABLE coverage_chain_test_receipts (id TEXT PRIMARY KEY)")
  expect(
    await f.database
      .batch([
        f.database.prepare("INSERT INTO coverage_chain_test_receipts VALUES ('stale')"),
        ...chain.assertions,
      ])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM coverage_chain_test_receipts")
      .first<number>("n"),
  ).toBe(0)
  expect(await prepareSystemRecordKindCoverage(chainVerifierContext, chainScope)).toBeInstanceOf(
    Error,
  )
  const freshFreeze = crypto.randomUUID()
  await new CreateRecordSourceFreeze({
    repository: openSystemRecordSourceFreezes({ env, assertions: [] }),
  }).execute(
    {
      id: freshFreeze,
      sourceNamespace: f.settings.sourceNamespace,
      ownerContext: "attendance",
      actorAccountId: creator,
      reason: "Verify all records",
    },
    new Date(),
  )
  await execSql(
    f.database,
    "INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:record:read'),('role:attendance-archive','system:admin')",
  )
  const stepUpToken = "d".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  const issuedAt = Date.now()
  await f.database
    .prepare(
      "INSERT INTO system_step_up_grants (id,account_id,token_hash,method,issued_at,expires_at,last_used_at) VALUES ('coverage-grant',?1,?2,'external_identity',?3,?4,?3)",
    )
    .bind(creator, hash, issuedAt, issuedAt + 60000)
    .run()
  const requestRecordOperation = async (
    input: unknown,
    database: D1Database = f.database,
    options: Readonly<{
      anonymous?: boolean
      withoutStepUp?: boolean
      plan?: boolean
      verification?: boolean
      at?: Date
    }> = {},
  ) => {
    const command = z
      .object({ id: z.uuid(), freezeId: z.uuid(), sourceNamespace: z.string() })
      .passthrough()
      .parse(input)
    const body = Object.fromEntries(
      Object.entries(command).filter(
        ([key]) => !["id", "freezeId", "sourceNamespace"].includes(key),
      ),
    )
    const secret = "coverage-route-test-secret"
    const token = await new SystemAccessTokenIssuer(secret).issue({
      accountId: creator,
      tokenVersion: 0,
      now: new Date(),
    })
    if (token instanceof Error) throw token
    const app = attendanceFactory
      .createApp()
      .use("*", async (c, next) => {
        c.set("database", drizzle(database))
        c.set("now", () => options.at ?? context.var.now())
        await next()
      })
      .onError((error, c) => {
        if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
        throw error
      })
      .post("/freezes/:freezeId/coverage-pages", ...verifyCoverage)
      .post("/freezes/:freezeId/retirement-plans", ...createRetirementPlan)
      .post("/retirement-plans/:planId/verification-receipts", ...verifyRetirement)
    return app.request(
      options.verification
        ? `/retirement-plans/${command.freezeId}/verification-receipts`
        : `/freezes/${command.freezeId}/${options.plan ? "retirement-plans" : "coverage-pages"}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": command.id,
          ...(options.anonymous ? {} : { authorization: `Bearer ${token}` }),
          ...(options.withoutStepUp ? {} : { "x-system-step-up": stepUpToken }),
        },
        body: JSON.stringify(body),
      },
      {
        ...env,
        DB: database,
        JWT_SECRET: secret,
        RECORD_SOURCE_NAMESPACE: f.settings.sourceNamespace,
      },
    )
  }
  const requestCoverage = (input: unknown, database = f.database, options = {}) =>
    requestRecordOperation(input, database, options)
  const requestPlan = (input: unknown, options = {}) =>
    requestRecordOperation(input, f.database, { ...options, plan: true })
  const planCommand = {
    id: crypto.randomUUID(),
    freezeId: freshFreeze,
    sourceNamespace: f.settings.sourceNamespace,
    purpose: "archive",
  }
  expect((await requestPlan(planCommand, { anonymous: true })).status).toBe(401)
  expect((await requestPlan(planCommand, { withoutStepUp: true })).status).toBe(403)
  expect((await requestPlan(planCommand)).status).toBe(503)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_plans")
      .first<number>("n"),
  ).toBe(0)
  const coverageCommand = {
    id: crypto.randomUUID(),
    freezeId: freshFreeze,
    sourceNamespace: f.settings.sourceNamespace,
    purpose: "archive",
    records: [{ sourceRecordId: 1, preservedRecordId: receipt.record_id }],
  }
  expect((await requestCoverage(coverageCommand, f.database, { anonymous: true })).status).toBe(401)
  expect((await requestCoverage(coverageCommand, f.database, { withoutStepUp: true })).status).toBe(
    403,
  )
  expect((await requestCoverage({ ...coverageCommand, records: [] })).status).toBe(409)
  expect((await requestCoverage({ ...coverageCommand, afterCursor: "1" })).status).toBe(400)
  const savedCoverage = await requestCoverage(coverageCommand)
  if (savedCoverage.status !== 200) throw new Error(await savedCoverage.text())
  const coverageResponse = z.record(z.string(), z.unknown()).parse(await savedCoverage.json())
  expect(coverageResponse).toMatchObject({
    sequence: 1,
    afterCursor: null,
    nextCursor: null,
    recordCount: 1,
  })
  expect(savedCoverage.headers.get("Cache-Control")).toBe("no-store")
  expect(Object.keys(coverageResponse).sort()).toEqual([
    "afterCursor",
    "checkedAt",
    "digest",
    "freezeId",
    "id",
    "nextCursor",
    "recordCount",
    "sequence",
  ])
  expect((await requestCoverage({ ...coverageCommand, purpose: "different" })).status).toBe(409)
  const replayedCoverage = await requestCoverage(coverageCommand)
  expect(replayedCoverage.status).toBe(200)
  expect(await replayedCoverage.json()).toEqual(coverageResponse)
  expect((await requestCoverage({ ...coverageCommand, id: crypto.randomUUID() })).status).toBe(409)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_coverage_pages WHERE freeze_id=?1")
      .bind(freshFreeze)
      .first<number>("n"),
  ).toBe(1)
  await execSql(
    f.database,
    `CREATE TRIGGER reject_attendance_retirement_plan BEFORE INSERT
    ON system_record_retirement_plans BEGIN
    SELECT RAISE(ABORT,'test retirement plan failure'); END`,
  )
  expect((await requestPlan(planCommand)).status).toBe(503)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE action='system.record.retirement.plan.created'",
      )
      .first<number>("n"),
  ).toBe(0)
  await execSql(f.database, "DROP TRIGGER reject_attendance_retirement_plan")
  await execSql(
    f.database,
    `CREATE TRIGGER revoke_attendance_plan_authority AFTER INSERT
    ON system_audit_events WHEN NEW.action='system.record.retirement.plan.created' BEGIN
    DELETE FROM system_iam_role_permissions WHERE role_id='role:attendance-archive'
      AND permission_key='system:admin'; END`,
  )
  expect((await requestPlan(planCommand)).status).toBe(503)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_plans")
      .first<number>("n"),
  ).toBe(0)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_iam_role_permissions WHERE role_id='role:attendance-archive' AND permission_key='system:admin'",
      )
      .first<number>("n"),
  ).toBe(1)
  await execSql(f.database, "DROP TRIGGER revoke_attendance_plan_authority")
  // 両要求を同じ認証時点で実行し、再認証grantの時計逆行拒否と計画の同時作成を分ける。
  const concurrentAt = new Date()
  const concurrentPlans = await Promise.all([
    requestPlan(planCommand, { at: concurrentAt }),
    requestPlan(planCommand, { at: concurrentAt }),
  ])
  const planned = concurrentPlans[0]
  const concurrentPlan = concurrentPlans[1]
  if (planned === undefined || concurrentPlan === undefined)
    throw new Error("missing plan responses")
  expect(concurrentPlan.status).toBe(200)
  if (planned.status !== 200) throw new Error(await planned.text())
  const planResponse = await planned.json()
  expect(await concurrentPlan.json()).toEqual(planResponse)
  expect(planResponse).toMatchObject({
    id: planCommand.id,
    freezeId: freshFreeze,
    totalPages: 1,
    recordKinds: ["attendance-record"],
  })
  expect(planned.headers.get("Cache-Control")).toBe("no-store")
  const verificationCommand = {
    id: crypto.randomUUID(),
    freezeId: planCommand.id,
    sourceNamespace: f.settings.sourceNamespace,
  }
  const requestVerification = (input: unknown, options = {}) =>
    requestRecordOperation(input, f.database, { ...options, verification: true })
  expect((await requestVerification(verificationCommand, { anonymous: true })).status).toBe(401)
  expect((await requestVerification(verificationCommand, { withoutStepUp: true })).status).toBe(403)
  expect((await requestVerification({ ...verificationCommand, ordinal: 2 })).status).toBe(400)
  expect(
    (await requestVerification({ ...verificationCommand, freezeId: crypto.randomUUID() })).status,
  ).toBe(409)
  await execSql(
    f.database,
    `CREATE TRIGGER reject_attendance_verification BEFORE INSERT
    ON system_record_retirement_receipts BEGIN SELECT RAISE(ABORT,'test verification failure'); END`,
  )
  expect((await requestVerification(verificationCommand)).status).toBe(503)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_receipts")
      .first<number>("n"),
  ).toBe(0)
  await execSql(f.database, "DROP TRIGGER reject_attendance_verification")
  await execSql(
    f.database,
    `CREATE TRIGGER revoke_attendance_verification_authority AFTER INSERT
    ON system_audit_events WHEN NEW.action='system.record.retirement.page.verified' BEGIN
    DELETE FROM system_iam_role_permissions WHERE role_id='role:attendance-archive'
      AND permission_key='system:record:read'; END`,
  )
  expect((await requestVerification(verificationCommand)).status).toBe(503)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_receipts")
      .first<number>("n"),
  ).toBe(0)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE action='system.record.retirement.page.verified'",
      )
      .first<number>("n"),
  ).toBe(0)
  await execSql(f.database, "DROP TRIGGER revoke_attendance_verification_authority")
  const verification = await requestVerification(verificationCommand)
  if (verification.status !== 200) throw new Error(await verification.text())
  const verificationResponse = await verification.json()
  expect(verificationResponse).toMatchObject({
    id: verificationCommand.id,
    planId: planCommand.id,
    ordinal: 1,
  })
  expect(verification.headers.get("Cache-Control")).toBe("no-store")
  const verificationReplay = await requestVerification(verificationCommand)
  expect(verificationReplay.status).toBe(200)
  expect(await verificationReplay.json()).toEqual(verificationResponse)
  expect(
    (await requestVerification({ ...verificationCommand, id: crypto.randomUUID() })).status,
  ).toBe(409)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_receipts")
      .first<number>("n"),
  ).toBe(1)

  const replayedPlan = await requestPlan(planCommand)
  expect(replayedPlan.status).toBe(200)
  expect(await replayedPlan.json()).toEqual(planResponse)
  expect((await requestPlan({ ...planCommand, purpose: "different" })).status).toBe(503)
  expect((await requestPlan({ ...planCommand, recordKinds: [] })).status).toBe(400)
  await execSql(
    f.database,
    "DELETE FROM system_iam_role_permissions WHERE role_id='role:attendance-archive' AND permission_key='system:admin'",
  )
  expect((await requestPlan(planCommand)).status).toBe(403)
  expect((await requestVerification(verificationCommand)).status).toBe(403)
  await execSql(
    f.database,
    "INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:admin')",
  )
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE action='system.record.retirement.plan.created'",
      )
      .first<number>("n"),
  ).toBe(1)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_plans")
      .first<number>("n"),
  ).toBe(1)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_source_retirements")
      .first<number>("n"),
  ).toBe(0)
  await new ReleaseRecordSourceFreeze({
    repository: openSystemRecordSourceFreezes({ env, assertions: [] }),
  }).execute(
    {
      id: freshFreeze,
      sourceNamespace: f.settings.sourceNamespace,
      ownerContext: "attendance",
      actorAccountId: creator,
      reason: "New verification",
    },
    new Date(),
  )
  expect((await requestPlan(planCommand)).status).toBe(503)
  expect((await requestVerification(verificationCommand)).status).toBe(503)
  const raceFreeze = crypto.randomUUID()
  await new CreateRecordSourceFreeze({
    repository: openSystemRecordSourceFreezes({ env, assertions: [] }),
  }).execute(
    {
      id: raceFreeze,
      sourceNamespace: f.settings.sourceNamespace,
      ownerContext: "attendance",
      actorAccountId: creator,
      reason: "Verify race",
    },
    new Date(),
  )
  const beforeReads = await f.database
    .prepare("SELECT count(*) AS n FROM system_audit_events WHERE action='system.record.disclosed'")
    .first<number>("n")
  const mutation = { applied: false }
  const raceDatabase = new Proxy(f.database, {
    get(target, key, receiver) {
      if (key !== "batch") return Reflect.get(target, key, receiver)
      return async <T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> => {
        const results = await target.batch<T>(statements)
        const reads = await target
          .prepare(
            "SELECT count(*) AS n FROM system_audit_events WHERE action='system.record.disclosed'",
          )
          .first<number>("n")
        if (!mutation.applied && reads !== beforeReads) {
          mutation.applied = true
          await execSql(
            target,
            "DELETE FROM system_iam_role_permissions WHERE permission_key='system:record:read'",
          )
        }
        return results
      }
    },
  })
  expect(
    (
      await requestCoverage(
        { ...coverageCommand, id: crypto.randomUUID(), freezeId: raceFreeze },
        raceDatabase,
      )
    ).status,
  ).toBe(503)
  expect(mutation.applied).toBe(true)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_coverage_pages WHERE freeze_id=?1")
      .bind(raceFreeze)
      .first<number>("n"),
  ).toBe(0)
  await execSql(
    f.database,
    "INSERT INTO system_iam_role_permissions VALUES ('role:attendance-archive','system:record:read')",
  )
  const activePlanId = crypto.randomUUID()
  const activeCoverageId = crypto.randomUUID()
  expect(
    (await requestCoverage({ ...coverageCommand, id: activeCoverageId, freezeId: raceFreeze }))
      .status,
  ).toBe(200)
  expect(
    (await requestPlan({ ...planCommand, id: activePlanId, freezeId: raceFreeze })).status,
  ).toBe(200)
  const heldVerification = {
    ...verificationCommand,
    id: crypto.randomUUID(),
    freezeId: activePlanId,
  }
  expect((await requestVerification(heldVerification)).status).toBe(200)
  const originalReceipt = await openSystemPreservedRecords({ env, assertions: [] }).find(
    receipt.record_id,
  )
  if (originalReceipt === null || originalReceipt instanceof Error)
    throw new Error("missing preserved receipt")
  const retentionAdapterContext = {
    env,
    assertions: [f.database.prepare("SELECT 1")],
  }
  const retention = await prepareSystemPreservedRecordRetentionGuard(
    retentionAdapterContext,
    originalReceipt,
    new Date(),
  )
  if (retention instanceof Error) throw retention
  const holds = openSystemAttachmentPreservations({ env, assertions: [] })
  const held = await holds.find(originalReceipt.snapshot.preservationId)
  if (held === null || held instanceof Error) throw new Error("missing approved hold")
  const released = held.release({
    operationId: crypto.randomUUID(),
    actorAccountId: creator,
    reason: "Release approved hold",
    at: new Date().toISOString(),
    auditEventId: crypto.randomUUID(),
  })
  if (released instanceof Error) throw released
  const releaseAudit = released.audit(held)
  if (releaseAudit instanceof Error) throw releaseAudit
  expect(await holds.write(released, releaseAudit)).toBe("written")
  expect((await requestVerification(heldVerification)).status).toBe(503)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_receipts")
      .first<number>("n"),
  ).toBe(2)
  expect(
    await prepareSystemPreservedRecordRetentionGuard(
      retentionAdapterContext,
      originalReceipt,
      new Date(),
    ),
  ).toBeInstanceOf(Error)
  await execSql(f.database, "CREATE TABLE retention_test_receipts(id TEXT PRIMARY KEY)")
  expect(
    await f.database
      .batch([
        f.database.prepare("INSERT INTO retention_test_receipts VALUES ('stale')"),
        ...retention.assertions,
      ])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM retention_test_receipts")
      .first<number>("n"),
  ).toBe(0)
  expect(
    (await requestCoverage({ ...coverageCommand, id: activeCoverageId, freezeId: raceFreeze }))
      .status,
  ).toBe(503)
})
