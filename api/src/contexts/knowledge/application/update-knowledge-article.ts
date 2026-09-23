import { KnowledgeAuthorAuthorizationAdapter } from "@/contexts/knowledge/infrastructure/adapters/knowledge-author-authorization.adapter"
import { ConflictError } from "@/lib/errors"
import type { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { KnowledgeContext as Context } from "@/contexts/knowledge/configuration/knowledge-context"
import { KnowledgeArticleRepository } from "@/contexts/knowledge/infrastructure/repositories/knowledge-article.repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { isKnowledgeRecordSourceFrozenError } from "@/contexts/knowledge/infrastructure/repositories/lib/is-knowledge-article-record-source-frozen-error"

export type Command = {
  expectedRevision: number
  commandId: string
  reason: string
  articleId: number
  authorId: EmployeeId
  title: string
  category: string
  tags: string | null
  bodyMd: string
}

/**
 * ナレッジ記事の表題・カテゴリ・タグ・本文を更新する。作成者以外の更新を拒否する。
 */
export class UpdateKnowledgeArticle {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<KnowledgeArticle | ApplicationError> {
    const articleRepository = new KnowledgeArticleRepository(this.c)

    const authorization = await new KnowledgeAuthorAuthorizationAdapter(this.c).prepare(
      command.authorId,
    )
    if (authorization instanceof Error) return authorization
    const requestJson = JSON.stringify({
      articleId: command.articleId,
      expectedRevision: command.expectedRevision,
      title: command.title,
      category: command.category,
      tags: command.tags,
      bodyMd: command.bodyMd,
      reason: command.reason,
    })
    const recorded = await articleRepository.readRecordedCommand({
      ...authorization,
      actorAccountId: authorization.accountId,
      commandId: command.commandId,
    })
    if (recorded instanceof Error)
      return new UnexpectedError("failed to read knowledge command", { cause: recorded })
    if (recorded !== null)
      return recorded.requestJson === requestJson && recorded.article.id === command.articleId
        ? recorded.article
        : new ConflictError(
            "command key was used for different content",
            "knowledge_command_conflict",
          )
    const current = await articleRepository.findById(command.articleId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find knowledge article", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("knowledge article not found", "article_not_found")
    }

    if (current.authorId !== command.authorId) {
      return new ForbiddenError("not the author", "not_author")
    }

    if (current.revision !== command.expectedRevision || current.status !== "active")
      return new ConflictError("knowledge article changed", "knowledge_revision_conflict")
    const updated = current.withContent({
      title: command.title,
      category: command.category,
      tags: command.tags,
      bodyMd: command.bodyMd,
    })

    const result = await articleRepository.appendRevision(updated, {
      ...authorization,
      actorAccountId: authorization.accountId,
      at: authorization.now,
      expectedRevision: command.expectedRevision,
      commandId: command.commandId,
      reason: command.reason,
      requestJson,
    })

    if (result instanceof Error) {
      if (isKnowledgeRecordSourceFrozenError(result))
        return new ConflictError("knowledge writes are frozen", "record_source_frozen", {
          cause: result,
        })
      return new UnexpectedError("failed to update knowledge article", { cause: result })
    }

    if (result === null) {
      return new ConflictError("knowledge article changed", "knowledge_revision_conflict")
    }

    return result
  }
}
