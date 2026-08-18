import { DeleteKnowledgeArticle } from "@/contexts/knowledge/application/delete-knowledge-article"
import { UpdateKnowledgeArticle } from "@/contexts/knowledge/application/update-knowledge-article"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { knowledgeArticles } from "@/contexts/knowledge/infrastructure/schema/knowledge"
import { validateIntParam } from "@/contexts/company-compatibility/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import {
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { zAppKnowledge, zAppKnowledgeWritten } from "@/lib/app-schemas"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
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

  const responseBody = zAppKnowledge.parse({
    id: row.id,
    title: row.title,
    category: row.category,
    tags: row.tags,
    body_md: row.bodyMd,
    author_id: row.authorId,
    created_at: row.createdAt,
  })

  return c.json(responseBody, 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /knowledge-articles/:id — ナレッジ記事の表題・カテゴリ・タグ・本文を更新（作成者のみ） */
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

    if (article instanceof ApplicationError) {
      throw toHttpException(article)
    }

    const responseBody = zAppKnowledgeWritten.parse({
      id: article.id,
      title: article.title,
      category: article.category,
      tags: article.tags,
      body_md: article.bodyMd,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /knowledge-articles/:id — ナレッジ記事を削除（作成者のみ） */
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

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
