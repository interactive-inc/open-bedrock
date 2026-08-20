import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { LinkAttachments } from "@system/application/attachments/link-attachments"
import { ReadAttachment } from "@system/application/attachments/read-attachment"
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { AttachmentRepository } from "@system/infrastructure/attachments/attachment-repository"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { R2TestBucket, testKekEnv } from "@/api/test/support/r2-test-bucket"
import { schema } from "@/schema"

const ownerAccountId = "acc_owner"

const otherAccountId = "acc_other"

const now = new Date("2026-08-20T09:00:00.000Z")

function receiptBytes(): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode("%PDF-1.7 領収書 12,800円 タクシー")
}

function createContext(bucket: R2TestBucket, kekEnv: string = testKekEnv(1)) {
  const db = createD1TestDatabase(loadSchema())

  return {
    var: { database: drizzle(db, { schema }) },
    env: { ATTACHMENTS: bucket as unknown as R2Bucket, ATTACHMENT_KEKS: kekEnv },
  }
}

describe("添付の保管と取り出し", () => {
  test("保管すると pending になり、object storage には暗号文だけが置かれる", async () => {
    const bucket = new R2TestBucket()

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

    const row = await new AttachmentRepository(context).findById(stored.id)

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

  test("復号して元の内容と整合が取れる", async () => {
    const bucket = new R2TestBucket()

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

    const content = await new ReadAttachment(context).run(stored.id)

    if (content instanceof Error) throw content

    expect(content.content).toEqual(plaintext)
    expect(content.fileName).toBe("領収書.pdf")
    expect(content.contentType).toBe("application/pdf")
  })

  test("許可していない形式と上限超過を拒否する", async () => {
    const bucket = new R2TestBucket()

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
    const bucket = new R2TestBucket()

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

  test("暗号化に使った KEK version が設定から消えると復号を拒否する", async () => {
    const bucket = new R2TestBucket()

    const context = createContext(bucket, testKekEnv(1))

    const stored = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "領収書.pdf",
      contentType: "application/pdf",
      content: receiptBytes(),
      now,
    })

    if (stored instanceof Error) throw stored

    const rotated = {
      var: context.var,
      env: { ATTACHMENTS: bucket as unknown as R2Bucket, ATTACHMENT_KEKS: testKekEnv(2) },
    }

    expect(await new ReadAttachment(rotated).run(stored.id)).toBeInstanceOf(Error)
  })
})

describe("業務レコードへの紐づけ", () => {
  test("本人の pending だけを linked にできる", async () => {
    const bucket = new R2TestBucket()

    const context = createContext(bucket)

    const stored = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "領収書.pdf",
      contentType: "application/pdf",
      content: receiptBytes(),
      now,
    })

    if (stored instanceof Error) throw stored

    const linked = await new LinkAttachments(context).run({
      attachmentIds: [stored.id],
      ownerAccountId,
      now,
    })

    expect(linked).toBeUndefined()

    const row = await new AttachmentRepository(context).findById(stored.id)

    if (row instanceof Error || row === null) throw new Error("行が無い")

    expect(row.status).toBe("linked")
    expect(row.linkedAt).toEqual(now)
  })

  test("他人の添付は紐づけできない", async () => {
    const bucket = new R2TestBucket()

    const context = createContext(bucket)

    const stored = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "領収書.pdf",
      contentType: "application/pdf",
      content: receiptBytes(),
      now,
    })

    if (stored instanceof Error) throw stored

    const linked = await new LinkAttachments(context).run({
      attachmentIds: [stored.id],
      ownerAccountId: otherAccountId,
      now,
    })

    expect(linked).toBeInstanceOf(Error)
  })

  test("同じ添付を二重に紐づけできない", async () => {
    const bucket = new R2TestBucket()

    const context = createContext(bucket)

    const stored = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "領収書.pdf",
      contentType: "application/pdf",
      content: receiptBytes(),
      now,
    })

    if (stored instanceof Error) throw stored

    await new LinkAttachments(context).run({
      attachmentIds: [stored.id],
      ownerAccountId,
      now,
    })

    const second = await new LinkAttachments(context).run({
      attachmentIds: [stored.id],
      ownerAccountId,
      now,
    })

    expect(second).toBeInstanceOf(Error)
  })

  test("存在しない添付は紐づけできない", async () => {
    const bucket = new R2TestBucket()

    const context = createContext(bucket)

    const linked = await new LinkAttachments(context).run({
      attachmentIds: ["00000000-0000-4000-8000-000000000000"],
      ownerAccountId,
      now,
    })

    expect(linked).toBeInstanceOf(Error)
  })
})
