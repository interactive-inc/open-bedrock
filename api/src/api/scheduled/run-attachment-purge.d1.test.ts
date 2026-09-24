import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { runScheduledAttachmentPurge } from "@/api/scheduled/run-attachment-purge"
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { systemAttachmentSchema } from "@system/infrastructure/schema/system-attachment"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { type LocalD1, applyMigrations, startLocalD1 } from "@tests/d1/support/start-local-d1"

const uploadedAt = new Date("2026-08-19T09:00:00.000Z")
const purgeAt = new Date("2026-08-21T09:00:00.000Z")

let local: LocalD1

// 独立したローカルD1へ全migrationを適用するため、1件あたり数秒かかる。
setDefaultTimeout(120_000)

beforeAll(async () => {
  local = await startLocalD1(["purge"])
})

afterAll(async () => {
  await local.dispose()
})

async function createFixture(name: string) {
  const db = await local.database(name)
  await applyMigrations(db)
  const bucket = new SystemAttachmentTestBucket()
  const database = drizzle(db, { schema: systemAttachmentSchema })
  const store = async (now: Date) => {
    const stored = await new StoreAttachment({
      var: { database },
      env: {
        ATTACHMENTS: bucket as unknown as R2Bucket,
        ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
      },
    }).run({
      ownerAccountId: "account-member",
      fileName: "receipt.pdf",
      contentType: "application/pdf",
      content: new TextEncoder().encode("%PDF-1.7 receipt"),
      now,
    })
    if (stored instanceof Error) throw stored
    return stored.id
  }
  return {
    bucket,
    store,
    attachments: new AttachmentAdapter({ var: { database } }),
    run: (enabled: string | undefined) =>
      runScheduledAttachmentPurge({
        env: {
          DB: db,
          ATTACHMENTS: bucket as unknown as R2Bucket,
          ATTACHMENT_PURGE_SCHEDULE_ENABLED: enabled,
        },
        clock: () => purgeAt,
      }),
  }
}

describe("runScheduledAttachmentPurge", () => {
  test("不正な設定値と保存先の欠落はDBへ触れずに失敗として返す", async () => {
    const run = (enabled: string, storage: R2Bucket | undefined) =>
      runScheduledAttachmentPurge({
        env: {
          DB: {} as D1Database,
          ATTACHMENTS: storage,
          ATTACHMENT_PURGE_SCHEDULE_ENABLED: enabled,
        },
        clock: () => purgeAt,
      })
    expect(
      await run("yes", new SystemAttachmentTestBucket() as unknown as R2Bucket),
    ).toBeInstanceOf(Error)
    expect(await run("true", undefined)).toBeInstanceOf(Error)
  })

  test("無効なら何も削除せず、有効なら期限切れの未紐付け添付だけを回収する", async () => {
    const fixture = await createFixture("purge")
    const stale = await fixture.store(uploadedAt)
    const fresh = await fixture.store(new Date(purgeAt.getTime() - 60_000))
    const linked = await fixture.store(uploadedAt)
    const marked = await fixture.attachments.markLinked(linked, uploadedAt)
    if (marked instanceof Error) throw marked

    for (const enabled of [undefined, "", "false"]) {
      expect(await fixture.run(enabled)).toEqual([])
    }
    expect(await fixture.attachments.findById(stale)).toMatchObject({ status: "pending" })
    expect(fixture.bucket.size()).toBe(3)

    expect(await fixture.run("true")).toEqual([stale])
    expect(await fixture.attachments.findById(stale)).toBeNull()
    expect(await fixture.attachments.findById(fresh)).toMatchObject({ status: "pending" })
    expect(await fixture.attachments.findById(linked)).toMatchObject({ status: "linked" })
    expect(fixture.bucket.size()).toBe(2)

    expect(await fixture.run("true")).toEqual([])
  })
})
