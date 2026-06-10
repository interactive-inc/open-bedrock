import { DeleteKnowledgeArticle } from "@/application/knowledge/delete-knowledge-article"
import { UpdateKnowledgeArticle } from "@/application/knowledge/update-knowledge-article"
import { factory } from "@/lib/factory"
import { knowledgeArticles } from "@/schema"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }

  const articleId = validateIntParam(c.req.param("id"), "knowledge")

  const rows = await c.var.database
    .select()
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.id, articleId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("knowledge not found")
  }

  const responseBody = {
    id: row.id,
    title: row.title,
    category: row.category,
    tags: row.tags,
    body_md: row.bodyMd,
    author_id: row.authorId,
  }

  return c.json(responseBody, 200)
})

// PUT /knowledge/:id — ナレッジ記事の表題・カテゴリ・タグ・本文を更新（作成者のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      category: z.string().min(1).max(200),
      tags: z.string().max(500).nullable().optional(),
      body_md: z.string().min(1).max(50_000),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const articleId = validateIntParam(c.req.param("id"), "knowledge")

    const json = c.req.valid("json")

    const article = await new UpdateKnowledgeArticle(c).run({
      articleId,
      authorId: viewer.employeeId,
      title: json.title,
      category: json.category,
      tags: json.tags ?? null,
      bodyMd: json.body_md,
    })

    if (article instanceof Error) {
      throw new InternalError("failed to update knowledge")
    }

    if ("reason" in article) {
      if (article.reason === "article_not_found") {
        throw new NotFoundError("knowledge not found")
      }

      throw new ForbiddenError("not the author")
    }

    const responseBody = {
      id: article.id,
      title: article.title,
      category: article.category,
      tags: article.tags,
      body_md: article.bodyMd,
    }

    return c.json(responseBody, 200)
  },
)

// DELETE /knowledge/:id — ナレッジ記事を削除（作成者のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const articleId = validateIntParam(c.req.param("id"), "knowledge")

  const result = await new DeleteKnowledgeArticle(c).run({
    articleId,
    authorId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete knowledge")
  }

  if (result.reason === "article_not_found") {
    throw new NotFoundError("knowledge not found")
  }

  if (result.reason === "not_author") {
    throw new ForbiddenError("not the author")
  }

  return c.body(null, 204)
})
