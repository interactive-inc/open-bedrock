import { KnowledgeAuthorAuthorizationAdapter } from "@/contexts/knowledge/infrastructure/adapters/knowledge-author-authorization.adapter"
import { ConflictError } from "@/lib/errors"
import type { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { KnowledgeContext as Context } from "@/contexts/knowledge/configuration/knowledge-context"
import { KnowledgeArticleRepository } from "@/contexts/knowledge/infrastructure/repositories/knowledge-article.repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  expectedRevision: number
  commandId: string
  reason: string
  articleId: number
  authorId: EmployeeId
}

/**
 * ナレッジ記事を取下げ、本文と改訂履歴を保存する。作成者以外の取下げを拒否する。
 */
export class WithdrawKnowledgeArticle {
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
      operation: "withdraw",
      articleId: command.articleId,
      expectedRevision: command.expectedRevision,
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
    const updated = current.withdraw()

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
      return new UnexpectedError("failed to update knowledge article", { cause: result })
    }

    if (result === null) {
      return new ConflictError("knowledge article changed", "knowledge_revision_conflict")
    }

    return result
  }
}
