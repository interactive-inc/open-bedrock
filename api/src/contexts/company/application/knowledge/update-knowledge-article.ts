import type { KnowledgeArticle } from "@/domain/knowledge/knowledge-article.entity"
import type { Context } from "@/env"
import { KnowledgeArticleRepository } from "@/infrastructure/knowledge/knowledge-article-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  articleId: number
  authorId: number
  title: string
  category: string
  tags: string | null
  bodyMd: string
}

/**
 * ナレッジ記事の表題・カテゴリ・タグ・本文を更新する。作成者以外の更新を拒否する。
 */
export class UpdateKnowledgeArticle {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<KnowledgeArticle | ApplicationError> {
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

    const updated = current.withContent({
      title: command.title,
      category: command.category,
      tags: command.tags,
      bodyMd: command.bodyMd,
    })

    const result = await articleRepository.update(updated)

    if (result instanceof Error) {
      return new UnexpectedError("failed to update knowledge article", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("knowledge article not found", "article_not_found")
    }

    return result
  }
}
