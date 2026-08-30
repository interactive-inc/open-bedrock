import { CreateKnowledgeArticle } from "@/contexts/knowledge/application/create-knowledge-article"
import { factory } from "@/api/http/factory"
import { likeKeyword } from "@/lib/database/like-keyword"
import { knowledgeArticles } from "@/contexts/knowledge/infrastructure/schema/knowledge"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import {
  zAppKnowledgeList,
  zAppKnowledgeWritten,
} from "@/contexts/knowledge/interface/http/response-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { and, count, desc, eq, or, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const keyword = c.req.query("q") ?? null

  const category = c.req.query("category") ?? null

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const conditions: Array<SQL> = []

  if (category !== null) {
    conditions.push(eq(knowledgeArticles.category, category))
  }

  if (keyword !== null) {
    const keywordMatch = or(
      likeKeyword(knowledgeArticles.title, keyword),
      likeKeyword(knowledgeArticles.bodyMd, keyword),
      likeKeyword(sql`COALESCE(${knowledgeArticles.tags}, '')`, keyword),
    )

    if (keywordMatch !== undefined) {
      conditions.push(keywordMatch)
    }
  }

  const where = conditions.length === 0 ? undefined : and(...conditions)

  const [rows, totalRows] = await Promise.all([
    c.var.database
      .select()
      .from(knowledgeArticles)
      .where(where)
      .orderBy(desc(knowledgeArticles.id))
      .limit(limit)
      .offset(offset),
    c.var.database.select({ total: count() }).from(knowledgeArticles).where(where),
  ])

  const responseBody = zAppKnowledgeList.parse({
    data: rows.map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      snippet: row.bodyMd.replace(/\s+/g, " ").trim().slice(0, 200),
      author_id: row.authorId,
      created_at: row.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

// @authorization owner - 本人のリソースに限定する
/** POST /knowledge-articles — ナレッジ記事を新規作成（作成者は本人） */
export const POST = factory.createHandlers(
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

    const json = c.req.valid("json")

    const article = await new CreateKnowledgeArticle(c).run({
      title: json.title,
      category: json.category,
      tags: json.tags ?? null,
      bodyMd: json.body_md,
      authorId: viewer.employeeId,
      createdAt: c.env.NOW ?? new Date().toISOString(),
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

    return c.json(responseBody, 201)
  },
)
