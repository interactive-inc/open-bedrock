import type { DocumentContext } from "@/contexts/document/configuration/document-context"
import { DocumentActorReadAdapter } from "@/contexts/document/infrastructure/adapters/document-actor-read.adapter"
import { DocumentError } from "@/contexts/document/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { z } from "zod"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'document-record', 'version', 2,
  'document', json_object(
    'id', id,
    'legacy_id', legacy_id,
    'title', title,
    'category', category,
    'location', location,
    'counterparty_reference', counterparty_reference,
    'expires_on', expires_on,
    'note', note,
    'created_at', created_at
  )
) AS snapshot_json FROM document_ledger_entries WHERE id = ?1`

type Context = DocumentContext

/** 管理資格のある主体へ文書台帳の原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureDocumentRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ documentId: string; sourceNamespace: string }>) {
    if (!z.uuid().safeParse(input.documentId).success)
      return new DocumentError("forbidden", "invalid source record")
    const actor = await new DocumentActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.documentId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("document source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("document source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "document",
        recordKind: "document-record",
        recordId: String(input.documentId),
        formatId: "document-record",
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
          context: "document",
          kind: "record-snapshot",
          id: String(input.documentId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.documentId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("document source capture failed", { cause })
    }
  }
}
