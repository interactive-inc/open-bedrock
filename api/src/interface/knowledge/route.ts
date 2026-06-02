import { CreateKnowledgeArticle } from "@/application/knowledge/create-knowledge-article"
import { factory } from "@/lib/factory"
import { likeKeyword } from "@/interface/shared/like-keyword"
import { knowledgeArticles } from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { and, eq, or, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const keyword = c.req.query("q") ?? null

  const category = c.req.query("category") ?? null

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

  const rows = await c.var.database
    .select()
    .from(knowledgeArticles)
    .where(conditions.length === 0 ? undefined : and(...conditions))

  const responseBody = rows.map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    snippet: row.bodyMd.replace(/\s+/g, " ").trim(),
  }))

  return c.json(responseBody, 200)
})

// POST /knowledge — ナレッジ記事を新規作成（作成者は本人）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1),
      category: z.string().min(1),
      tags: z.string().nullable().optional(),
      body_md: z.string().min(1),
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
      createdAt: new Date().toISOString(),
    })

    if (article instanceof Error) {
      throw new InternalError("failed to create knowledge")
    }

    const responseBody = {
      id: article.id,
      title: article.title,
      category: article.category,
      tags: article.tags,
      body_md: article.bodyMd,
    }

    return c.json(responseBody, 201)
  },
)
