import type { AttachmentStatus } from "@system/domain/definitions/attachments/attachment-status.definition"
import { SystemAttachmentError } from "@system/domain/errors"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"
import { systemAttachments } from "@system/infrastructure/schema/system-attachment"
import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context.repository"
import { and, eq, inArray, lt } from "drizzle-orm"

export type NewAttachment = Readonly<{
  id: string
  ownerAccountId: string
  objectKey: string
  contentType: string
  byteSize: number
  fileName: string
  plaintextSha256: string
  wrappedDek: string
  wrappedDekIv: string
  contentIv: string
  kekVersion: number
  createdAt: Date
}>

/** 添付メタデータの永続化。本体の所在と復号鍵を持つ唯一の場所。 */
export class AttachmentRepository {
  constructor(private readonly c: SystemDatabaseContext) {
    Object.freeze(this)
  }

  /**
   * 本体を書く前に uploading 行を予約する。この順にすることで
   * 「object storage にあるが行が無い」孤児が構造的に発生しない。
   */
  async reserve(input: NewAttachment): Promise<void | Error> {
    try {
      await this.c.var.database.insert(systemAttachments).values({
        id: input.id,
        ownerAccountId: input.ownerAccountId,
        objectKey: input.objectKey,
        status: "uploading",
        contentType: input.contentType,
        byteSize: input.byteSize,
        fileName: input.fileName,
        plaintextSha256: input.plaintextSha256,
        wrappedDek: input.wrappedDek,
        wrappedDekIv: input.wrappedDekIv,
        contentIv: input.contentIv,
        kekVersion: input.kekVersion,
        createdAt: input.createdAt,
        linkedAt: null,
        erasedAt: null,
      })

      return undefined
    } catch (error) {
      return new SystemAttachmentError(
        "unexpected",
        "attachment_reservation_failed",
        "添付の予約に失敗しました",
        { cause: error },
      )
    }
  }

  async markPending(id: string): Promise<void | Error> {
    return this.updateStatus(id, "uploading", "pending", null)
  }

  /** 業務レコードへの紐づけ。pending の行だけが linked へ進める。 */
  async markLinked(id: string, linkedAt: Date): Promise<void | Error> {
    return this.updateStatus(id, "pending", "linked", linkedAt)
  }

  private async updateStatus(
    id: string,
    from: AttachmentStatus,
    to: AttachmentStatus,
    linkedAt: Date | null,
  ): Promise<void | Error> {
    try {
      const updated = await this.c.var.database
        .update(systemAttachments)
        .set(linkedAt === null ? { status: to } : { status: to, linkedAt })
        .where(and(eq(systemAttachments.id, id), eq(systemAttachments.status, from)))
        .returning({ id: systemAttachments.id })

      if (updated.length === 0) {
        return new SystemAttachmentError(
          "unexpected",
          "attachment_transition_failed",
          `添付の状態を ${from} から ${to} へ変更できませんでした`,
        )
      }

      return undefined
    } catch (error) {
      return new SystemAttachmentError(
        "unexpected",
        "attachment_transition_failed",
        "添付の状態更新に失敗しました",
        { cause: error },
      )
    }
  }

  async findById(id: string): Promise<SystemAttachmentRow | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(systemAttachments)
        .where(eq(systemAttachments.id, id))
        .limit(1)

      return rows.at(0) ?? null
    } catch (error) {
      return new SystemAttachmentError(
        "unexpected",
        "attachment_read_failed",
        "添付の取得に失敗しました",
        { cause: error },
      )
    }
  }

  async findManyByIds(
    ids: ReadonlyArray<string>,
  ): Promise<ReadonlyArray<SystemAttachmentRow> | Error> {
    if (ids.length === 0) return []

    try {
      return await this.c.var.database
        .select()
        .from(systemAttachments)
        .where(inArray(systemAttachments.id, [...ids]))
    } catch (error) {
      return new SystemAttachmentError(
        "unexpected",
        "attachment_read_failed",
        "添付の取得に失敗しました",
        { cause: error },
      )
    }
  }

  /** 掃除バッチ用。紐づかないまま期限を過ぎた行を拾う。 */
  async listStaleUnlinked(
    threshold: Date,
    limit: number,
  ): Promise<ReadonlyArray<SystemAttachmentRow> | Error> {
    try {
      return await this.c.var.database
        .select()
        .from(systemAttachments)
        .where(
          and(
            inArray(systemAttachments.status, ["uploading", "pending"]),
            lt(systemAttachments.createdAt, threshold),
          ),
        )
        .limit(limit)
    } catch (error) {
      return new SystemAttachmentError(
        "unexpected",
        "attachment_scan_failed",
        "添付の走査に失敗しました",
        { cause: error },
      )
    }
  }

  /** 掃除バッチ用。本体を消した行を落とす。業務へ紐づいた行は対象にしない。 */
  async deleteUnlinked(id: string): Promise<void | Error> {
    try {
      await this.c.var.database
        .delete(systemAttachments)
        .where(
          and(
            eq(systemAttachments.id, id),
            inArray(systemAttachments.status, ["uploading", "pending"]),
          ),
        )

      return undefined
    } catch (error) {
      return new SystemAttachmentError(
        "unexpected",
        "attachment_delete_failed",
        "添付の削除に失敗しました",
        { cause: error },
      )
    }
  }
}
