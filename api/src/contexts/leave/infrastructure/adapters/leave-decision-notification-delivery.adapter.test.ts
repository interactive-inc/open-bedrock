import { runScheduledLeaveNotifications } from "@/api/scheduled/run-leave-notifications"
import { expect, spyOn, test } from "bun:test"
import { createLeaveProcedureDecisionTestContext } from "@/contexts/leave/test/leave-procedure-decision.test-support"
import { LeaveDecisionNotificationDeliveryAdapter } from "@/contexts/leave/infrastructure/adapters/leave-decision-notification-delivery.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

async function fixture() {
  const prepared = await createLeaveProcedureDecisionTestContext()
  const f = { ...prepared, db: prepared.database }
  await f.db
    .exec(`INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES ('notification-worker','active',0,0,0);
    INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at) VALUES ('notification-principal','notification-worker','service','Notification worker',1,0,0);
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at) VALUES ('notification-role','notification-worker','custom','Notification worker',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('notification-role','batch:execute'),('notification-role','employee:read'),('notification-role','leave:read:all');
    INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES ('notification-binding','notification-worker','notification-role',0);`)
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
      "SELECT count(*) AS count FROM system_notification_messages WHERE id LIKE 'leave-decision:%'",
    ).first<number>("count")
  return { ...f, clock, run, count }
}

test("並行配送と再実行でも通知を一度だけ保存する", async () => {
  const f = await fixture()
  const outcomes = await Promise.all([f.run(), f.run()])
  expect(outcomes.flat()).toEqual(
    expect.arrayContaining([expect.objectContaining({ status: "succeeded" })]),
  )
  expect(await f.count()).toBe(1)
  expect(await f.run()).toEqual([])
  expect(
    await f.context.env.DB.prepare(
      "SELECT recipient_account_id FROM system_notification_deliveries WHERE id LIKE 'leave-decision:%'",
    ).first<string>("recipient_account_id"),
  ).toBe(f.creator.accountId)
})

test("通知保存に失敗しても承認済みの判断を保持し、復旧後に配送する", async () => {
  const f = await fixture()
  await f.db.exec(
    `CREATE TRIGGER fail_leave_delivery BEFORE INSERT ON system_notification_messages WHEN NEW.id LIKE 'leave-decision:%' BEGIN SELECT RAISE(ABORT,'delivery unavailable'); END`,
  )
  expect(await f.run()).toEqual([expect.objectContaining({ status: "queued" })])
  expect(await f.count()).toBe(0)
  expect((await f.persisted())?.status).toBe("approved")
  await f.db.exec("DROP TRIGGER fail_leave_delivery")
  f.clock.at = new Date(f.clock.at.getTime() + 60000)
  expect(await f.run()).toEqual([expect.objectContaining({ status: "succeeded" })])
  expect(await f.count()).toBe(1)
})

for (const status of ["suspended", "locked"]) {
  test(`受信者が${status}の場合は配信せず、再開後に再送する`, async () => {
    const f = await fixture()
    await f.context.env.DB.prepare(
      `UPDATE system_accounts SET status = ?1, token_version = token_version + 1 WHERE id = '${f.creator.accountId}'`,
    )
      .bind(status)
      .run()
    expect(await f.run()).toEqual([expect.objectContaining({ status: "queued" })])
    expect(await f.count()).toBe(0)
    await f.db.exec(
      `UPDATE system_accounts SET status = 'active', token_version = token_version + 1 WHERE id = '${f.creator.accountId}'`,
    )
    f.clock.at = new Date(f.clock.at.getTime() + 60000)
    expect(await f.run()).toEqual([expect.objectContaining({ status: "succeeded" })])
    expect(await f.count()).toBe(1)
  })
}

test("受信Accountが終了済みなら配信しない", async () => {
  const f = await fixture()
  await f.context.env.DB.prepare(
    `UPDATE system_accounts SET closed_at = ?1, updated_at = ?1, status = 'suspended', token_version = token_version + 1 WHERE id = '${f.creator.accountId}'`,
  )
    .bind(f.clock.at.getTime())
    .run()
  expect(await f.run()).toEqual([expect.objectContaining({ status: "queued" })])
  expect(await f.count()).toBe(0)
})

test("Serviceの休暇参照権限が失効したら配信せず、復旧後に再送する", async () => {
  const f = await fixture()
  await f.db.exec(
    "DELETE FROM system_iam_role_permissions WHERE role_id = 'notification-role' AND permission_key = 'leave:read:all'",
  )
  expect(await f.run()).toEqual([expect.objectContaining({ status: "queued" })])
  expect(await f.count()).toBe(0)
  await f.db.exec(
    "INSERT INTO system_iam_role_permissions VALUES ('notification-role','leave:read:all')",
  )
  f.clock.at = new Date(f.clock.at.getTime() + 60000)
  expect(await f.run()).toEqual([expect.objectContaining({ status: "succeeded" })])
  expect(await f.count()).toBe(1)
})

test("定期配送は明示設定とApp有効化を必要とする", async () => {
  const f = await fixture()
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
    const f = await fixture()
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
        await f.db.exec(
          `UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1 WHERE id = '${f.creator.accountId}'`,
        )
      } else {
        await f.db.exec(
          "DELETE FROM system_iam_role_permissions WHERE role_id = 'notification-role' AND permission_key = 'leave:read:all'",
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
  const f = await fixture()
  await f.db.exec(
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
