import { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { KnowledgeContext as Context } from "@/contexts/knowledge/configuration/knowledge-context"
import { KnowledgeAuthorAuthorizationAdapter } from "@/contexts/knowledge/infrastructure/adapters/knowledge-author-authorization.adapter"
import { KnowledgeArticleRepository } from "@/contexts/knowledge/infrastructure/repositories/knowledge-article.repository"
import { ConflictError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  title: string
  category: string
  tags: string | null
  bodyMd: string
  authorId: EmployeeId
  commandId: string
  reason: string
}

/**
 * ナレッジ記事を新規作成する。作成者は author となる。
 */
export class CreateKnowledgeArticle {
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
      operation: "create",
      title: command.title,
      category: command.category,
      tags: command.tags,
      bodyMd: command.bodyMd,
      authorId: command.authorId,
      reason: command.reason,
    })
    const article = KnowledgeArticle.create({
      title: command.title,
      category: command.category,
      tags: command.tags,
      bodyMd: command.bodyMd,
      authorId: command.authorId,
      createdAt: authorization.now.toISOString(),
    })

    const created = await articleRepository.createWithHistory(article, {
      ...authorization,
      actorAccountId: authorization.accountId,
      commandId: command.commandId,
      reason: command.reason,
      requestJson,
      at: authorization.now,
    })

    if (created instanceof Error) {
      return new UnexpectedError("failed to create knowledge article", { cause: created })
    }

    if (created === null)
      return new ConflictError(
        "command key was used for different content",
        "knowledge_command_conflict",
      )
    return created
  }
}
