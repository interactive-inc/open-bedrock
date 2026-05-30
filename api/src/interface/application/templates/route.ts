import { factory } from "@/lib/factory"
import { applicationTemplates } from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// GET /templates — 申請テンプレート一覧（カテゴリで絞り込み可）
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.object({ category: z.string().optional() })),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const rows = await c.var.database
      .select()
      .from(applicationTemplates)
      .where(
        query.category === undefined
          ? undefined
          : eq(applicationTemplates.category, query.category),
      )

    const responseBody = rows.map((row) => ({
      code: row.code,
      name: row.name,
      category: row.category,
      description: row.description,
    }))

    return c.json(responseBody, 200)
  },
)
