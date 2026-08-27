import { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import { KnowledgeArticleRepository } from "@/contexts/knowledge/infrastructure/repositories/knowledge-article.repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  title: string
  category: string
  tags: string | null
  bodyMd: string
  authorId: EmployeeId
  createdAt: string
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

    const article = KnowledgeArticle.create({
      title: command.title,
      category: command.category,
      tags: command.tags,
      bodyMd: command.bodyMd,
      authorId: command.authorId,
      createdAt: command.createdAt,
    })

    const created = await articleRepository.create(article)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create knowledge article", { cause: created })
    }

    return created
  }
}
