import { z } from "zod"
import type { AnnouncementContext } from "@/contexts/announcement/configuration/announcement-context"
import { AnnouncementActorReadAdapter } from "@/contexts/announcement/infrastructure/adapters/announcement-actor-read.adapter"
import { AnnouncementError } from "@/contexts/announcement/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'announcement-record', 'version', 2,
  'announcement', json_object(
    'id', id,
    'legacy_id', legacy_id,
    'title', title,
    'body_md', body_md,
    'published_on', published_on,
    'author_employee_id', author_employee_id,
    'status', status,
    'created_at', created_at
  )
) AS snapshot_json FROM announcements WHERE id = ?1`

type Context = AnnouncementContext

/** 管理資格のある主体へ原記録と履歴を返し、保全までの変更・資格失効を検出する。 */
export class CaptureAnnouncementRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ announcementId: string; sourceNamespace: string }>) {
    if (!z.uuid().safeParse(input.announcementId).success)
      return new AnnouncementError("forbidden", "invalid source record")
    const actor = await new AnnouncementActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.announcementId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("announcement source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("announcement source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "announcement",
        recordKind: "announcement-record",
        recordId: String(input.announcementId),
        formatId: "announcement-record",
        formatVersion: 2,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: actor.now.toISOString(),
        contentDigest: digest.toString(),
      })
      if (source instanceof Error) return source
      return {
        source,
        content: new TextEncoder().encode(canonical.toString()),
        actorAccountId: actor.accountId,
        sourceAuthorizationRef: Object.freeze({
          context: "announcement",
          kind: "record-snapshot",
          id: String(input.announcementId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.announcementId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("announcement source capture failed", { cause })
    }
  }
}
