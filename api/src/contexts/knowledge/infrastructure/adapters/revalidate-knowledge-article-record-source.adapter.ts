import type { KnowledgeContext } from "@/contexts/knowledge/configuration/knowledge-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureKnowledgeRecordAdapter } from "@/contexts/knowledge/infrastructure/adapters/capture-knowledge-article-record.adapter"
import { KnowledgeError } from "@/contexts/knowledge/domain/errors"
import { z } from "zod"

type Context = KnowledgeContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateKnowledgeRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "knowledge" ||
      source.props.recordKind !== "knowledge-article-record"
    )
      return new KnowledgeError(
        "forbidden",
        "record source does not belong to this knowledge registry",
      )

    const articleId = z.uuid().safeParse(source.props.recordId)
    if (!articleId.success || String(articleId.data) !== source.props.recordId)
      return new KnowledgeError("forbidden", "invalid knowledge record identifier")
    const current = await new CaptureKnowledgeRecordAdapter(this.c).prepare({
      articleId: articleId.data,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new KnowledgeError(
        "knowledge_conflict",
        "knowledge record differs from preservation proposal",
      )

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
