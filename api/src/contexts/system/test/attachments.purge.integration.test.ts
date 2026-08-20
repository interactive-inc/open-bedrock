import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { LinkAttachments } from "@system/application/attachments/link-attachments"
import {
  PurgeUnlinkedAttachments,
  UNLINKED_ATTACHMENT_RETENTION_MILLISECONDS,
} from "@system/application/attachments/purge-unlinked-attachments"
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { AttachmentRepository } from "@system/infrastructure/attachments/attachment-repository"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { R2TestBucket, testKekEnv } from "@/api/test/support/r2-test-bucket"
import { schema } from "@/schema"

const ownerAccountId = "acc_owner"

const uploadedAt = new Date("2026-08-20T09:00:00.000Z")

/** 期限ちょうどでは消さず、超えたら消す。JST 表記でそろえるが判定は経過時間で行う。 */
const justBeforeDeadline = new Date(
  uploadedAt.getTime() + UNLINKED_ATTACHMENT_RETENTION_MILLISECONDS - 1000,
)

const afterDeadline = new Date(
  uploadedAt.getTime() + UNLINKED_ATTACHMENT_RETENTION_MILLISECONDS + 1000,
)

function createContext(bucket: R2TestBucket) {
  const db = createD1TestDatabase(loadSchema())

  return {
    var: { database: drizzle(db, { schema }) },
    env: { ATTACHMENTS: bucket as unknown as R2Bucket, ATTACHMENT_KEKS: testKekEnv(1) },
  }
}

async function storePending(context: ReturnType<typeof createContext>): Promise<string> {
  const stored = await new StoreAttachment(context).run({
    ownerAccountId,
    fileName: "領収書.pdf",
    contentType: "application/pdf",
    content: new TextEncoder().encode("%PDF-1.7 領収書"),
    now: uploadedAt,
  })

  if (stored instanceof Error) throw stored

  return stored.id
}

describe("紐づかない添付の掃除", () => {
  test("期限内の pending は消さない", async () => {
    const bucket = new R2TestBucket()

    const context = createContext(bucket)

    const id = await storePending(context)

    const result = await new PurgeUnlinkedAttachments(context).run({ now: justBeforeDeadline })

    if (result instanceof Error) throw result

    expect(result.purgedCount).toBe(0)
    expect(bucket.size()).toBe(1)
    expect(await new AttachmentRepository(context).findById(id)).not.toBeNull()
  })

  test("期限を過ぎた pending は本体も行も消す", async () => {
    const bucket = new R2TestBucket()

    const context = createContext(bucket)

    const id = await storePending(context)

    const result = await new PurgeUnlinkedAttachments(context).run({ now: afterDeadline })

    if (result instanceof Error) throw result

    expect(result.purgedCount).toBe(1)
    expect(bucket.size()).toBe(0)
    expect(await new AttachmentRepository(context).findById(id)).toBeNull()
  })

  test("業務レコードへ紐づいた添付は期限を過ぎても消さない", async () => {
    const bucket = new R2TestBucket()

    const context = createContext(bucket)

    const id = await storePending(context)

    await new LinkAttachments(context).run({
      attachmentIds: [id],
      ownerAccountId,
      now: uploadedAt,
    })

    const result = await new PurgeUnlinkedAttachments(context).run({ now: afterDeadline })

    if (result instanceof Error) throw result

    expect(result.purgedCount).toBe(0)
    expect(bucket.size()).toBe(1)

    const row = await new AttachmentRepository(context).findById(id)

    if (row instanceof Error || row === null) throw new Error("行が無い")

    expect(row.status).toBe("linked")
  })
})
