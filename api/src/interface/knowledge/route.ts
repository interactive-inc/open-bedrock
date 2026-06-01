import { factory } from "@/lib/factory"
import { likeKeyword } from "@/interface/shared/like-keyword"
import { knowledgeArticles } from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { and, eq, or, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

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
