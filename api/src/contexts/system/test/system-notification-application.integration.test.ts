import { PublishSystemNotification } from "@system/application/notifications/publish-system-notification"
import { zAccountId } from "@system/domain/auth/account-id"
import { NotificationDeliveryBatch } from "@system/domain/notifications/notification-delivery-batch"
import { NotificationDelivery } from "@system/domain/notifications/notification-delivery.entity"
import { NotificationMessage } from "@system/domain/notifications/notification-message.entity"
import { createSystemD1TestDatabase } from "@system/infrastructure/auth/create-system-d1-test-database.test-support"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification.repository"
import { describe, expect, test } from "bun:test"

const notificationSchema = `
PRAGMA foreign_keys = ON;

CREATE TABLE system_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'locked')),
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE system_notification_messages (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  source_type TEXT,
  source_id TEXT,
  created_at INTEGER NOT NULL,
  CHECK ((source_type IS NULL AND source_id IS NULL) OR
         (source_type IS NOT NULL AND source_id IS NOT NULL))
);

CREATE TABLE system_notification_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES system_notification_messages(id) ON DELETE RESTRICT,
  recipient_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delivered_at INTEGER NOT NULL,
  read_at INTEGER,
  UNIQUE (message_id, recipient_account_id),
  CHECK (read_at IS NULL OR read_at >= delivered_at)
);
`

describe("canonical System Notification Application + D1 repository", () => {
  test("200 AccountへのMessageとDeliveryを件数非依存の3 queryで不可分にfan-outする", async () => {
    let queryCount = 0
    const database = createSystemD1TestDatabase(notificationSchema, {
      onQuery: () => {
        queryCount += 1
      },
    })
    const accounts = Array.from({ length: 200 }, (_, index) => `account-${index + 1}`)

    await database.batch(
      accounts.map((accountId) =>
        database
          .prepare(
            `INSERT INTO system_accounts
               (id, status, token_version, created_at, updated_at)
             VALUES (?1, 'active', 0, 1000, 1000)`,
          )
          .bind(accountId),
      ),
    )

    const message = createMessage("message-fan-out")
    const deliveries = createDeliveryBatch(
      accounts.map((accountId, index) =>
        createDelivery({
          id: `delivery-${index + 1}`,
          messageId: message.id,
          recipientAccountId: accountId,
        }),
      ),
    )
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const publish = new PublishSystemNotification({ notificationRepository: repository })

    queryCount = 0
    expect(await publish.execute({ message, deliveries })).toEqual({ kind: "published" })
    expect(queryCount).toBe(3)

    const deliveryCount = await database
      .prepare("SELECT count(*) AS count FROM system_notification_deliveries")
      .first<number>("count")
    expect(deliveryCount).toBe(200)
  })

  test("1 Accountでも無効ならMessageと他のDeliveryを含め全rollbackする", async () => {
    const database = createSystemD1TestDatabase(notificationSchema)
    await insertAccount(database, "account-active", "active")
    await insertAccount(database, "account-suspended", "suspended")

    const message = createMessage("message-rollback")
    const deliveries = createDeliveryBatch([
      createDelivery({
        id: "delivery-active",
        messageId: message.id,
        recipientAccountId: "account-active",
      }),
      createDelivery({
        id: "delivery-suspended",
        messageId: message.id,
        recipientAccountId: "account-suspended",
      }),
    ])
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const publish = new PublishSystemNotification({ notificationRepository: repository })

    expect(await publish.execute({ message, deliveries })).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM system_notification_messages")
        .first<number>("count"),
    ).toBe(0)
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM system_notification_deliveries")
        .first<number>("count"),
    ).toBe(0)
  })

  test("Account単位の一覧・未読件数・一括既読・破棄をcanonical Deliveryだけで処理する", async () => {
    const database = createSystemD1TestDatabase(notificationSchema)
    await insertAccount(database, "account-owner", "active")
    await insertAccount(database, "account-other", "active")
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })

    for (const [index, accountId] of [
      "account-owner",
      "account-owner",
      "account-other",
    ].entries()) {
      const message = createMessage(`message-list-${index + 1}`)
      const deliveries = createDeliveryBatch([
        createDelivery({
          id: `delivery-list-${index + 1}`,
          messageId: message.id,
          recipientAccountId: accountId,
        }),
      ])
      expect(
        await new PublishSystemNotification({ notificationRepository: repository }).execute({
          message,
          deliveries,
        }),
      ).toEqual({ kind: "published" })
    }

    const accountId = zAccountId.parse("account-owner")
    expect(await repository.countUnreadForAccount(accountId)).toBe(2)

    const page = await repository.listForAccount({
      recipientAccountId: accountId,
      read: false,
      limit: 1,
      offset: 0,
    })
    expect(page).not.toBeInstanceOf(Error)
    if (page instanceof Error) throw page
    expect(page.total).toBe(2)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.message.title).toBe("System test notification")
    expect(String(page.items[0]?.delivery.recipientAccountId)).toBe("account-owner")

    expect(await repository.markAllDeliveriesRead(accountId, new Date(3_000))).toBe(2)
    expect(await repository.countUnreadForAccount(accountId)).toBe(0)
    expect(
      await repository.dismissDelivery(
        page.items[0]!.delivery.id,
        zAccountId.parse("account-other"),
      ),
    ).toBe(false)
    expect(await repository.dismissDelivery(page.items[0]!.delivery.id, accountId)).toBe(true)
    expect(
      await repository.findByDeliveryIdForAccount(page.items[0]!.delivery.id, accountId),
    ).toBeNull()
  })
})

function createMessage(id: string): NotificationMessage {
  const message = NotificationMessage.create({
    id,
    kind: "system:test.created",
    title: "System test notification",
    body: "plain text body",
    source: { type: "system:test.source", id: `source-${id}` },
    createdAt: new Date(1_000),
  })

  if (message instanceof Error) throw message
  return message
}

function createDelivery(props: {
  id: string
  messageId: string
  recipientAccountId: string
}): NotificationDelivery {
  const delivery = NotificationDelivery.create({
    ...props,
    deliveredAt: new Date(2_000),
    readAt: null,
  })

  if (delivery instanceof Error) throw delivery
  return delivery
}

function createDeliveryBatch(deliveries: Array<NotificationDelivery>): NotificationDeliveryBatch {
  const batch = NotificationDeliveryBatch.create(deliveries)

  if (batch instanceof Error) throw batch
  return batch
}

async function insertAccount(
  database: D1Database,
  accountId: string,
  status: "active" | "suspended",
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO system_accounts
         (id, status, token_version, created_at, updated_at)
       VALUES (?1, ?2, 0, 1000, 1000)`,
    )
    .bind(accountId, status)
    .run()
}
