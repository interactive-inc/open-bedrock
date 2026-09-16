import type { KnowledgeContext } from "@/contexts/knowledge/configuration/knowledge-context"
import { KnowledgeActorReadAdapter } from "@/contexts/knowledge/infrastructure/adapters/knowledge-actor-read.adapter"
import { KnowledgeError } from "@/contexts/knowledge/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { z } from "zod"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'knowledge-article-record', 'version', 1,
  'article', json_object(
    'id', id,
    'title', title,
    'category', category,
    'tags', tags,
    'body_md', body_md,
    'author_id', author_id,
    'created_at', created_at,
    'revision', revision,
    'status', status
  ),
  'revisions', json(coalesce((SELECT json_group_array(json(value)) FROM (
    SELECT json_object(
      'article_id', article_id,
      'revision', revision,
      'snapshot_json', snapshot_json,
      'status', status,
      'source', source,
      'actor_account_id', actor_account_id,
      'reason', reason,
      'recorded_at', recorded_at,
      'command_id', command_id,
      'request_json', request_json
    ) AS value FROM knowledge_article_revisions WHERE article_id = ?1 ORDER BY revision
  )), '[]'))
) AS snapshot_json, revision AS source_revision FROM knowledge_articles article WHERE id = ?1`

type Context = KnowledgeContext

/** 保全資格のある主体へ記事と全改訂履歴を返し、保全までの変更・資格失効を検出する。 */
export class CaptureKnowledgeRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ articleId: number; sourceNamespace: string }>) {
    if (!z.number().int().safe().safeParse(input.articleId).success)
      return new KnowledgeError("forbidden", "invalid source record")
    const actor = await new KnowledgeActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string; source_revision: number }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.articleId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("knowledge source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      const sourceRevision = reads.at(-1)?.results[0]?.source_revision
      if (
        snapshot === undefined ||
        typeof sourceRevision !== "number" ||
        !Number.isSafeInteger(sourceRevision) ||
        sourceRevision < 1
      )
        return new Error("knowledge source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "knowledge",
        recordKind: "knowledge-article-record",
        recordId: String(input.articleId),
        formatId: "knowledge-article-record",
        formatVersion: 1,
        sourceRevision: String(sourceRevision),
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
          context: "knowledge",
          kind: "record-snapshot",
          id: String(input.articleId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.articleId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("knowledge source capture failed", { cause })
    }
  }
}
