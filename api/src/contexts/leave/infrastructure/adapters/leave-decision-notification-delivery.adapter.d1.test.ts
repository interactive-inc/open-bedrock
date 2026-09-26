import { runScheduledLeaveNotifications } from "@/api/scheduled/run-leave-notifications"
import { afterAll, beforeAll, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { createLeaveProcedureDecisionLocalD1Context } from "@/contexts/leave/test/leave-procedure-local-d1.test-support"
import { LeaveDecisionNotificationDeliveryAdapter } from "@/contexts/leave/infrastructure/adapters/leave-decision-notification-delivery.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import { execSql } from "@tests/d1/support/exec-sql"
import { toSha256Hex } from "@/lib/crypto/to-sha256-hex"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "concurrent-delivery",
      "delivery-failure",
      "recipient-suspended",
      "recipient-locked",
      "closed-account",
      "service-permission",
      "scheduled-configuration",
      "revoked-recipient",
      "revoked-permission",
      "dead-letter",
      "legacy-payload",
      "legacy-payload-tampered",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

async function fixture(name: string) {
  const prepared = await createLeaveProcedureDecisionLocalD1Context(local, name)
  const f = { ...prepared, db: prepared.database }
  await execSql(
    f.db,
    `INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES ('notification-worker','active',0,0,0);
    INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at) VALUES ('notification-principal','notification-worker','service','Notification worker',1,0,0);
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at) VALUES ('92800b2d-97e7-4243-8a57-785b3e31b34b','notification-worker','custom','Notification worker',0,0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('92800b2d-97e7-4243-8a57-785b3e31b34b','batch:execute'),('92800b2d-97e7-4243-8a57-785b3e31b34b','employee:read'),('92800b2d-97e7-4243-8a57-785b3e31b34b','leave:read:all');
    INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES ('01fed7f6-b372-4c2b-83ba-c5e22f432953','notification-worker','92800b2d-97e7-4243-8a57-785b3e31b34b',0);`,
  )
  await f.prepareCompletion()
  expect(await f.complete()).toEqual({ status: "approved", replayed: false })
  const clock = { at: new Date(f.context.env.NOW) }
  const run = () =>
    new LeaveDecisionNotificationDeliveryAdapter({
      env: f.context.env,
      accountId: zAccountId.parse("notification-worker"),
      clock: () => clock.at,
    }).run(10)
  const count = () =>
    f.context.env.DB.prepare(
      "SELECT count(*) AS count FROM system_notification_messages WHERE id IN (SELECT job_id FROM leave_decision_notifications)",
    ).first<number>("count")
  return { ...f, clock, run, count }
}

test("並行配送と再実行でも通知を一度だけ保存する", async () => {
  const f = await fixture("concurrent-delivery")
  const outcomes = await Promise.all([f.run(), f.run()])
  expect(outcomes.flat()).toEqual(
    expect.arrayContaining([expect.objectContaining({ status: "succeeded" })]),
  )
  expect(await f.count()).toBe(1)
  expect(await f.run()).toEqual([])
  expect(
    await f.context.env.DB.prepare(
      "SELECT recipient_account_id FROM system_notification_deliveries WHERE id IN (SELECT job_id FROM leave_decision_notifications)",
    ).first<string>("recipient_account_id"),
  ).toBe(f.creator.accountId)
})

/**
 * 主キーを UUID へ移す前に作られた job を再現する。通知の行は申請の UUID へ書き換えられ、System の job の
 * digest は申請の整数の主キーを含む移行前の本文に対する値のまま残る。
 */
async function simulatePreMigrationJob(
  f: Awaited<ReturnType<typeof fixture>>,
  legacyId: string,
  digestLegacyId: number,
) {
  const row = await f.context.env.DB.prepare(
    "SELECT job_id, leave_request_id, payload_json FROM leave_decision_notifications",
  ).first<{ job_id: string; leave_request_id: string; payload_json: string }>()
  if (row === null) throw new Error("notification fixture missing")
  const legacyPayload = JSON.stringify({
    ...JSON.parse(row.payload_json),
    leaveRequestId: digestLegacyId,
  })
  // 移行が書き込む値を、変更を拒否する table の trigger を一時的に外して再現する。
  const bypass = async (table: string, statement: D1PreparedStatement) => {
    const guards = await f.context.env.DB.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?1",
    )
      .bind(table)
      .all<{ name: string; sql: string }>()
    for (const guard of guards.results) await execSql(f.db, `DROP TRIGGER ${guard.name}`)
    await statement.run()
    for (const guard of guards.results) await execSql(f.db, guard.sql)
  }
  await bypass(
    "system_jobs",
    f.context.env.DB.prepare("UPDATE system_jobs SET payload_digest = ?1 WHERE id = ?2").bind(
      await toSha256Hex(legacyPayload),
      row.job_id,
    ),
  )
  await bypass(
    "leave_requests",
    f.context.env.DB.prepare("UPDATE leave_requests SET legacy_id = ?1 WHERE id = ?2").bind(
      legacyId,
      row.leave_request_id,
    ),
  )
}

test("移行前に作られた job は申請の旧 ID から移行前の本文を組み立てて照合し、配送する", async () => {
  const f = await fixture("legacy-payload")
  await simulatePreMigrationJob(f, "41", 41)
  expect(await f.run()).toEqual([expect.objectContaining({ status: "succeeded" })])
  expect(await f.count()).toBe(1)
})

test("移行前の job の digest が申請の旧 ID と合わなければ改変として配送しない", async () => {
  const f = await fixture("legacy-payload-tampered")
  await simulatePreMigrationJob(f, "41", 42)
  expect(await f.run()).not.toEqual([expect.objectContaining({ status: "succeeded" })])
  expect(await f.count()).toBe(0)
})

test("通知保存に失敗しても承認済みの判断を保持し、復旧後に配送する", async () => {
  const f = await fixture("delivery-failure")
  await execSql(
    f.db,
    `CREATE TRIGGER fail_leave_delivery BEFORE INSERT ON system_notification_messages WHEN NEW.id IN (SELECT job_id FROM leave_decision_notifications) BEGIN SELECT RAISE(ABORT,'delivery unavailable'); END`,
  )
  expect(await f.run()).toEqual([expect.objectContaining({ status: "queued" })])
  expect(await f.count()).toBe(0)
  expect((await f.persisted())?.status).toBe("approved")
  await execSql(f.db, "DROP TRIGGER fail_leave_delivery")
  f.clock.at = new Date(f.clock.at.getTime() + 60000)
  expect(await f.run()).toEqual([expect.objectContaining({ status: "succeeded" })])
  expect(await f.count()).toBe(1)
})

for (const status of ["suspended", "locked"]) {
  test(`受信者が${status}の場合は配信せず、再開後に再送する`, async () => {
    const f = await fixture(`recipient-${status}`)
    await f.context.env.DB.prepare(
      `UPDATE system_accounts SET status = ?1, token_version = token_version + 1 WHERE id = '${f.creator.accountId}'`,
    )
      .bind(status)
      .run()
    expect(await f.run()).toEqual([expect.objectContaining({ status: "queued" })])
    expect(await f.count()).toBe(0)
    await execSql(
      f.db,
      `UPDATE system_accounts SET status = 'active', token_version = token_version + 1 WHERE id = '${f.creator.accountId}'`,
    )
    f.clock.at = new Date(f.clock.at.getTime() + 60000)
    expect(await f.run()).toEqual([expect.objectContaining({ status: "succeeded" })])
    expect(await f.count()).toBe(1)
  })
}

test("受信Accountが終了済みなら配信しない", async () => {
  const f = await fixture("closed-account")
  await f.context.env.DB.prepare(
    `UPDATE system_accounts SET closed_at = ?1, updated_at = ?1, status = 'suspended', token_version = token_version + 1 WHERE id = '${f.creator.accountId}'`,
  )
    .bind(f.clock.at.getTime())
    .run()
  expect(await f.run()).toEqual([expect.objectContaining({ status: "queued" })])
  expect(await f.count()).toBe(0)
})

test("Serviceの休暇参照権限が失効したら配信せず、復旧後に再送する", async () => {
  const f = await fixture("service-permission")
  await execSql(
    f.db,
    "DELETE FROM system_iam_role_permissions WHERE role_id = '92800b2d-97e7-4243-8a57-785b3e31b34b' AND permission_key = 'leave:read:all'",
  )
  expect(await f.run()).toEqual([expect.objectContaining({ status: "queued" })])
  expect(await f.count()).toBe(0)
  await execSql(
    f.db,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('92800b2d-97e7-4243-8a57-785b3e31b34b','leave:read:all')",
  )
  f.clock.at = new Date(f.clock.at.getTime() + 60000)
  expect(await f.run()).toEqual([expect.objectContaining({ status: "succeeded" })])
  expect(await f.count()).toBe(1)
})

test("定期配送は明示設定とApp有効化を必要とする", async () => {
  const f = await fixture("scheduled-configuration")
  const input = { env: f.context.env, clock: () => f.clock.at }
  expect(await runScheduledLeaveNotifications(input)).toEqual([])
  expect(await f.count()).toBe(0)
  const configured = {
    ...input,
    env: {
      ...input.env,
      LEAVE_NOTIFICATION_SERVICE_ACCOUNT_ID: "notification-worker",
      DISABLED_DEFAULT_APPS: "leave",
    },
  }
  expect(await runScheduledLeaveNotifications(configured)).toEqual([])
  expect(await f.count()).toBe(0)
  expect(
    await runScheduledLeaveNotifications({
      ...configured,
      env: { ...configured.env, DISABLED_DEFAULT_APPS: "", ENABLED_OPT_IN_APPS: "all" },
    }),
  ).toEqual([expect.objectContaining({ status: "succeeded" })])
  expect(await f.count()).toBe(1)
})

for (const mutation of ["recipient", "permission"]) {
  test(`配送準備後の${mutation}失効でも保存を拒否する`, async () => {
    const f = await fixture(`revoked-${mutation}`)
    const adapter = new LeaveDecisionNotificationDeliveryAdapter({
      env: f.context.env,
      accountId: zAccountId.parse("notification-worker"),
      clock: () => f.clock.at,
    })
    const prepare = adapter.prepare.bind(adapter)
    const interception = spyOn(
      LeaveDecisionNotificationDeliveryAdapter.prototype,
      "prepare",
    ).mockImplementation(async (job, at) => {
      const statements = await prepare(job, at)
      if (mutation === "recipient") {
        await execSql(
          f.db,
          `UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1 WHERE id = '${f.creator.accountId}'`,
        )
      } else {
        await execSql(
          f.db,
          "DELETE FROM system_iam_role_permissions WHERE role_id = '92800b2d-97e7-4243-8a57-785b3e31b34b' AND permission_key = 'leave:read:all'",
        )
      }
      return statements
    })
    try {
      expect(await f.run()).toEqual([expect.objectContaining({ status: "queued" })])
      expect(await f.count()).toBe(0)
      expect((await f.persisted())?.status).toBe("approved")
    } finally {
      interception.mockRestore()
    }
  })
}

test("配送不能が試行上限に達したらdead letterに残して自動再送を止める", async () => {
  const f = await fixture("dead-letter")
  await execSql(
    f.db,
    `UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1 WHERE id = '${f.creator.accountId}'`,
  )
  for (const attempt of Array.from({ length: 10 }, (_, index) => index + 1)) {
    expect(await f.run()).toEqual([
      expect.objectContaining({ status: attempt === 10 ? "dead_letter" : "queued" }),
    ])
    f.clock.at = new Date(f.clock.at.getTime() + 3600000)
  }
  expect(await f.run()).toEqual([])
  expect(await f.count()).toBe(0)
  expect((await f.persisted())?.status).toBe("approved")
  expect(
    await f.context.env.DB.prepare(
      "SELECT count(*) AS count FROM leave_decision_notifications",
    ).first<number>("count"),
  ).toBe(1)
})
