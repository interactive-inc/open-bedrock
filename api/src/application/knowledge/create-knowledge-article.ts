import { KnowledgeArticle } from "@/domain/knowledge/knowledge-article.entity"
import type { Context } from "@/env"
import { KnowledgeArticleRepository } from "@/infrastructure/knowledge/knowledge-article-repository"

export type Command = {
  title: string
  category: string
  tags: string | null
  bodyMd: string
  authorId: number
  createdAt: string
}

/**
 * ナレッジ記事を新規作成する。作成者は author となる。
 */
export class CreateKnowledgeArticle {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<KnowledgeArticle | Error> {
    const articleRepository = new KnowledgeArticleRepository(this.c)

    const article = KnowledgeArticle.create({
      title: command.title,
      category: command.category,
      tags: command.tags,
      bodyMd: command.bodyMd,
      authorId: command.authorId,
      createdAt: command.createdAt,
    })

    return await articleRepository.create(article)
  }
}
