import { zValidator } from "@hono/zod-validator"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { toBoundedInt } from "@/lib/http/to-bounded-int"
import { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import { z } from "zod"

const revisionSchema = z.object({
  revision: z.number().int().positive(),
  snapshot_json: z.string(),
  source: z.enum(["existing_record", "actor"]),
  actor_account_id: z.string().nullable(),
  reason: z.string(),
  recorded_at: z.number().int().nonnegative(),
})

// @authorization authenticated - 社内共有記事の本文と同じ閲覧範囲で改訂履歴を公開する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.object({ limit: z.string().optional(), offset: z.string().optional() })),
  async (c) => {
    if (c.var.session === null) throw new UnauthorizedError()
    const articleId = validateIntParam(c.req.param("id"), "knowledge")
    const limit = toBoundedInt({ raw: c.req.query("limit"), fallback: 20, min: 1, max: 100 })
    const offset = toBoundedInt({ raw: c.req.query("offset"), fallback: 0, min: 0, max: 100_000 })
    const results = await c.env.DB.batch([
      c.env.DB.prepare("SELECT id FROM knowledge_articles WHERE id=?1").bind(articleId),
      c.env.DB.prepare(`SELECT revision,snapshot_json,source,actor_account_id,reason,recorded_at
      FROM knowledge_article_revisions WHERE article_id=?1 ORDER BY revision DESC LIMIT ?2 OFFSET ?3`).bind(
        articleId,
        limit,
        offset,
      ),
      c.env.DB.prepare(
        "SELECT count(*) AS total FROM knowledge_article_revisions WHERE article_id=?1",
      ).bind(articleId),
    ])
    if (results[0]?.results.length === 0) throw new NotFoundError("knowledge not found")
    const data = z
      .array(revisionSchema)
      .parse(results[1]?.results)
      .map((row) => {
        const article = KnowledgeArticle.restore(JSON.parse(row.snapshot_json))
        if (article.id !== articleId || article.revision !== row.revision)
          throw new Error("knowledge revision snapshot mismatch")
        return {
          revision: row.revision,
          source: row.source,
          actor_account_id: row.actor_account_id,
          reason: row.reason,
          recorded_at: row.recorded_at,
          article: {
            id: article.id,
            revision: article.revision,
            status: article.status,
            title: article.title,
            category: article.category,
            tags: article.tags,
            body_md: article.bodyMd,
            author_id: article.authorId,
            created_at: article.createdAt,
          },
        }
      })
    const total = z
      .object({ total: z.number().int().nonnegative() })
      .parse(results[2]?.results[0]).total
    return c.json({ data, total }, 200)
  },
)
