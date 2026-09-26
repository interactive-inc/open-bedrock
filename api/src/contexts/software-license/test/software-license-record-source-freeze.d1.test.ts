import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { createLicenseFixture } from "@/contexts/software-license/test/create-license-fixture.test-support"
import { createSoftwareLicenseSourceFreezeHandlers } from "@/contexts/software-license/interface/operations/create-software-license-source-freeze-handlers"
import { createSoftwareLicenseSourceFreezeReadHandlers } from "@/contexts/software-license/interface/operations/create-software-license-source-freeze-read-handlers"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { RecordSourceFreezeEntity } from "@system/domain/entities/record-source-freeze.entity"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemHTTPException } from "@system/interface/errors"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"
import { execSql } from "@tests/d1/support/exec-sql"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(2)
})

afterAll(async () => {
  await pool.dispose()
})

function freezeEntity() {
  const freeze = RecordSourceFreezeEntity.create({
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "software-license",
    actorAccountId: "account:manager",
    reason: "Preserve the service register before retirement",
    createdAt: new Date().toISOString(),
    auditEventId: crypto.randomUUID(),
    revision: 1,
    release: null,
  })
  if (freeze instanceof Error) throw freeze
  return freeze
}

function auditStatement(
  db: D1Database,
  freeze: RecordSourceFreezeEntity,
  previous: RecordSourceFreezeEntity | null,
) {
  const value = freeze.snapshot
  const release = value.release
  return db
    .prepare(`INSERT INTO system_audit_events
    (event_id,actor_account_id,action,target_type,target_id,outcome,authorization_json,before_json,after_json,occurred_at)
    VALUES (?1,?2,?3,'system:record-source-freeze',?4,'succeeded','{}',?5,?6,?7)`)
    .bind(
      release?.auditEventId ?? value.auditEventId,
      release?.actorAccountId ?? value.actorAccountId,
      release === null
        ? "system.record.source.freeze.created"
        : "system.record.source.freeze.released",
      value.id,
      previous === null ? null : JSON.stringify(previous.snapshot),
      JSON.stringify(value),
      Date.parse(release?.at ?? value.createdAt),
    )
}

function insertStatement(db: D1Database, freeze: RecordSourceFreezeEntity) {
  const value = freeze.snapshot
  return db
    .prepare(`INSERT INTO system_record_source_freezes
    (id,source_namespace,owner_context,revision,created_audit_event_id,release_audit_event_id,snapshot_json)
    VALUES (?1,?2,?3,1,?4,NULL,?5)`)
    .bind(
      value.id,
      value.sourceNamespace,
      value.ownerContext,
      value.auditEventId,
      JSON.stringify(value),
    )
}

test("停止確定後は台帳・割当・変更履歴の全書込みをDBで拒否し、解除後だけ再開する", async () => {
  const f = await createLicenseFixture(await pool.next())
  const assignmentId = crypto.randomUUID()
  await f.database
    .prepare(`INSERT INTO software_license_assignments
      (id,license_id,employee_id,service_name,plan_name,account_reference,assigned_at,assigned_by,assigned_reason)
      VALUES (?1,?2,'employee:manager','Example Service','Team',NULL,1,'account:manager','Assigned')`)
    .bind(assignmentId, f.license.id)
    .run()
  const freeze = freezeEntity()
  await f.database.batch([
    auditStatement(f.database, freeze, null),
    insertStatement(f.database, freeze),
  ])
  const writes = [
    f.database.prepare(`INSERT INTO software_licenses
      (name,status,created_at,revision) VALUES ('Late service','active','2026-09-08',1)`),
    f.database.prepare("UPDATE software_licenses SET note='late' WHERE id=?1").bind(f.license.id),
    f.database.prepare("DELETE FROM software_licenses WHERE id=?1").bind(f.license.id),
    f.database
      .prepare(`INSERT INTO software_license_assignments
      (id,license_id,employee_id,service_name,assigned_at,assigned_by,assigned_reason)
      VALUES (?1,?2,'employee:manager','Example Service',2,'account:manager','Late')`)
      .bind(crypto.randomUUID(), f.license.id),
    f.database
      .prepare("UPDATE software_license_assignments SET release_reason='late' WHERE id=?1")
      .bind(assignmentId),
    f.database.prepare("DELETE FROM software_license_assignments WHERE id=?1").bind(assignmentId),
    f.database
      .prepare(`INSERT INTO software_license_changes
      (id,license_id,actor_account_id,recorded_at,before_json,after_json)
      VALUES (?1,?2,'account:manager',2,NULL,'{}')`)
      .bind(crypto.randomUUID(), f.license.id),
    f.database
      .prepare("UPDATE software_license_changes SET after_json='{}' WHERE license_id=?1")
      .bind(f.license.id),
    f.database
      .prepare("DELETE FROM software_license_changes WHERE license_id=?1")
      .bind(f.license.id),
  ]
  for (const write of writes)
    expect(await write.run().catch((error: unknown) => error)).toBeInstanceOf(Error)
  expect(
    (
      await f.request("/software-licenses", {
        method: "POST",
        headers: { "idempotency-key": "frozen:create" },
        body: { name: "Blocked service" },
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await f.request(`/software-licenses/${f.license.id}`, {
        method: "PUT",
        headers: { "if-match": `"${f.license.revision}"` },
        body: { name: "Blocked update" },
      })
    ).status,
  ).toBe(409)
  expect(
    await f.database
      .prepare("SELECT note FROM software_licenses WHERE id=?1")
      .bind(f.license.id)
      .first<string | null>("note"),
  ).toBeNull()

  const released = freeze.release({
    actorAccountId: "account:manager",
    reason: "Resume service register writes",
    at: new Date(Date.parse(freeze.snapshot.createdAt) + 1).toISOString(),
    auditEventId: crypto.randomUUID(),
  })
  if (released instanceof Error || released.snapshot.release === null) throw released
  await f.database.batch([
    auditStatement(f.database, released, freeze),
    f.database
      .prepare(`UPDATE system_record_source_freezes
        SET revision=2,release_audit_event_id=?1,snapshot_json=?2
        WHERE id=?3 AND snapshot_json IS ?4`)
      .bind(
        released.snapshot.release.auditEventId,
        JSON.stringify(released.snapshot),
        freeze.snapshot.id,
        JSON.stringify(freeze.snapshot),
      ),
  ])
  expect(
    await f.database
      .prepare("UPDATE software_licenses SET note='resumed' WHERE id=?1")
      .bind(f.license.id)
      .run(),
  ).toMatchObject({ success: true })
})

test("停止APIは人の管理権限と外部再認証を要求し、同じ世代を安全に再送する", async () => {
  const f = await createLicenseFixture(await pool.next())
  await execSql(
    f.database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('7a047d56-30bc-4028-888d-2294d2d80c99','system:admin')",
  )
  const now = new Date()
  const authentication = {
    accountId: zAccountId.parse("account:manager"),
    tokenVersion: 0,
    issuedAtMs: now.getTime() - 1_000,
    expiresAtMs: now.getTime() + 3_600_000,
    machineCredentialId: null,
    identityBindingId: null,
  }
  const raw = "a".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(raw)
  if (hash instanceof Error) throw hash
  await f.database
    .prepare(`INSERT INTO system_step_up_grants
      (id,account_id,token_hash,method,issued_at,expires_at)
      VALUES ('software-license-freeze-grant','account:manager',?1,'external_identity',?2,?3)`)
    .bind(hash, now.getTime(), now.getTime() + 60_000)
    .run()
  const identity = softwareLicenseFactory.createMiddleware(async (c, next) => {
    c.set("userId", authentication.accountId)
    c.set("now", () => now)
    c.set("bearerReadAuthentication", authentication)
    await next()
  })
  const app = new Hono()
    .onError((error, c) => {
      if (error instanceof SystemHTTPException) return c.json({ code: error.code }, error.status)
      throw error
    })
    .post("/freezes", identity, ...createSoftwareLicenseSourceFreezeHandlers("create"))
    .get("/freezes/:freezeId", identity, ...createSoftwareLicenseSourceFreezeReadHandlers())
    .post(
      "/freezes/:freezeId/release",
      identity,
      ...createSoftwareLicenseSourceFreezeHandlers("release"),
    )
  const id = crypto.randomUUID()
  const request = (path: string, stepUp: boolean, reason: string) =>
    app.request(
      path,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": id,
          ...(stepUp ? { "x-system-step-up": raw } : {}),
        },
        body: JSON.stringify({ reason }),
      },
      { DB: f.database, RECORD_SOURCE_NAMESPACE: "example-source" },
    )
  expect((await request("/freezes", false, "Preserve register")).status).toBe(403)
  expect((await request("/freezes", true, "Preserve register")).status).toBe(201)
  expect((await request("/freezes", true, "Preserve register")).status).toBe(200)
  expect((await request("/freezes", true, "Changed reason")).status).toBe(409)
  const active = await app.request(
    `/freezes/${id}`,
    {},
    { DB: f.database, RECORD_SOURCE_NAMESPACE: "example-source" },
  )
  expect(active.status).toBe(200)
  expect(await active.json()).toMatchObject({ freeze: { id, revision: 1, release: null } })
  expect((await request(`/freezes/${id}/release`, true, "Resume register")).status).toBe(200)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE target_type='system:record-source-freeze'",
      )
      .first<number>("n"),
  ).toBe(2)
})
