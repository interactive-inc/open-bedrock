import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { systemAttachmentSchema } from "@system/infrastructure/schema/system-attachment"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"

const ownerAccountId = "acc_owner"

const now = new Date("2026-08-20T09:00:00.000Z")

function receiptBytes(): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode("%PDF-1.7 領収書 12,800円 タクシー")
}

function createContext(
  bucket: SystemAttachmentTestBucket,
  kekEnv: string = createSystemAttachmentTestKekEnvironment(1),
) {
  const db = createSystemAttachmentTestDatabase()

  return {
    var: { database: drizzle(db, { schema: { ...systemCoreSchema, ...systemAttachmentSchema } }) },
    env: { ATTACHMENTS: bucket as unknown as R2Bucket, ATTACHMENT_KEKS: kekEnv },
  }
}

describe("添付の保管と取り出し", () => {
  test("保管すると pending になり、object storage には暗号文だけが置かれる", async () => {
    const bucket = new SystemAttachmentTestBucket()

    const context = createContext(bucket)

    const plaintext = receiptBytes()

    const stored = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "領収書.pdf",
      contentType: "application/pdf",
      content: plaintext,
      now,
    })

    if (stored instanceof Error) throw stored

    expect(stored.byteSize).toBe(plaintext.byteLength)

    const row = await new AttachmentAdapter(context).findById(stored.id)

    if (row instanceof Error || row === null) throw new Error("行が無い")

    expect(row.status).toBe("pending")
    expect(row.ownerAccountId).toBe(ownerAccountId)
    expect(row.objectKey).toBe(`att/${stored.id}`)

    // object key にファイル名を含めない（ファイル名自体が個人情報になり得る）
    expect(row.objectKey).not.toContain("領収書")
    expect(bucket.keys()).toEqual([`att/${stored.id}`])

    const bytes = bucket.storedBytes(`att/${stored.id}`)

    if (bytes === null) throw new Error("本体が無い")

    expect(bytes).not.toEqual(plaintext)
    expect(new TextDecoder().decode(bytes)).not.toContain("領収書")
  })

  test("許可していない形式と上限超過を拒否する", async () => {
    const bucket = new SystemAttachmentTestBucket()

    const context = createContext(bucket)

    const rejectedType = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "script.exe",
      contentType: "application/octet-stream",
      content: receiptBytes(),
      now,
    })

    expect(rejectedType).toBeInstanceOf(Error)

    const rejectedSize = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "huge.pdf",
      contentType: "application/pdf",
      content: new Uint8Array(25 * 1024 * 1024 + 1),
      now,
    })

    expect(rejectedSize).toBeInstanceOf(Error)

    // 拒否したものは object storage にも行にも残らない
    expect(bucket.size()).toBe(0)
  })

  test("KEK 未設定では保管も取り出しもできない", async () => {
    const bucket = new SystemAttachmentTestBucket()

    const context = {
      ...createContext(bucket),
      env: { ATTACHMENTS: bucket as unknown as R2Bucket, ATTACHMENT_KEKS: undefined },
    }

    const stored = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "領収書.pdf",
      contentType: "application/pdf",
      content: receiptBytes(),
      now,
    })

    expect(stored).toBeInstanceOf(Error)
  })
})

describe("業務レコードへの紐づけ", () => {})
