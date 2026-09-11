import { WithdrawKnowledgeArticle } from "@/contexts/knowledge/application/withdraw-knowledge-article"
import { UpdateKnowledgeArticle } from "@/contexts/knowledge/application/update-knowledge-article"
import { factory } from "@/api/http/factory"
import { knowledgeArticles } from "@/contexts/knowledge/infrastructure/schema/knowledge"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import {
  zAppKnowledge,
  zAppKnowledgeWritten,
} from "@/contexts/knowledge/interface/http/response-schemas"
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
    revision: row.revision,
    status: row.status,
    title: row.title,
    category: row.category,
    tags: row.tags,
    body_md: row.bodyMd,
    author_id: row.authorId,
    created_at: row.createdAt,
  })

  c.header("ETag", `"${row.revision}"`)
  return c.json(responseBody, 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /knowledge-articles/:id — ナレッジ記事の表題・カテゴリ・タグ・本文を更新（作成者のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "header",
    z.object({
      "if-match": z
        .string()
        .regex(/^"[1-9][0-9]*"$/)
        .transform((value) => Number(value.slice(1, -1)))
        .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
      "idempotency-key": z.string().trim().min(1).max(200),
    }),
  ),
  zValidator(
    "json",
    z.object({
      reason: z.string().trim().min(1).max(2000),
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
      expectedRevision: c.req.valid("header")["if-match"],
      commandId: c.req.valid("header")["idempotency-key"],
      reason: json.reason,
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
      revision: article.revision,
      status: article.status,
      title: article.title,
      category: article.category,
      tags: article.tags,
      body_md: article.bodyMd,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** 確認した版を取下げる。本文・履歴は保持する。 */
export const DELETE = factory.createHandlers(
  verifyBearer,
  zValidator(
    "header",
    z.object({
      "if-match": z
        .string()
        .regex(/^"[1-9][0-9]*"$/)
        .transform((value) => Number(value.slice(1, -1)))
        .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
      "idempotency-key": z.string().trim().min(1).max(200),
    }),
  ),
  zValidator("json", z.object({ reason: z.string().trim().min(1).max(2000) })),
  async (c) => {
    const viewer = c.var.session
    if (viewer === null) throw new UnauthorizedError()
    const result = await new WithdrawKnowledgeArticle(c).run({
      articleId: validateIntParam(c.req.param("id"), "knowledge"),
      authorId: viewer.employeeId,
      expectedRevision: c.req.valid("header")["if-match"],
      commandId: c.req.valid("header")["idempotency-key"],
      reason: c.req.valid("json").reason,
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return c.body(null, 204)
  },
)
