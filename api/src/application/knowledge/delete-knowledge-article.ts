import type { Context } from "@/env"
import { KnowledgeArticleRepository } from "@/infrastructure/knowledge/knowledge-article-repository"

export type Command = {
  articleId: number
  authorId: number
}

export type ArticleNotFound = { reason: "article_not_found" }

export type NotAuthor = { reason: "not_author" }

export type Deleted = { reason: "deleted" }

/**
 * ナレッジ記事を削除する。作成者以外の削除を拒否する。
 */
export class DeleteKnowledgeArticle {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ArticleNotFound | NotAuthor | Error> {
    const articleRepository = new KnowledgeArticleRepository(this.c)

    const current = await articleRepository.findById(command.articleId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "article_not_found" }
    }

    if (current.authorId !== command.authorId) {
      return { reason: "not_author" }
    }

    const deleted = await articleRepository.delete(command.articleId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
