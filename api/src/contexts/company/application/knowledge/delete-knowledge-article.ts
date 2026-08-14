import type { Context } from "@/env"
import { KnowledgeArticleRepository } from "@/contexts/company/infrastructure/knowledge/knowledge-article-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  articleId: number
  authorId: number
}

export type Deleted = { reason: "deleted" }

/**
 * ナレッジ記事を削除する。作成者以外の削除を拒否する。
 */
export class DeleteKnowledgeArticle {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const articleRepository = new KnowledgeArticleRepository(this.c)

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

    const deleted = await articleRepository.delete(command.articleId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete knowledge article", { cause: deleted })
    }

    return { reason: "deleted" }
  }
}
