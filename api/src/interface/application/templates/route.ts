import { factory } from "@/lib/factory"
import { applicationTemplates } from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { eq } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// GET /templates — 申請テンプレート一覧（カテゴリで絞り込み可）
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      category: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const rows = await c.var.database
      .select()
      .from(applicationTemplates)
      .where(
        query.category === undefined
          ? undefined
          : eq(applicationTemplates.category, query.category),
      )
      .limit(limit)
      .offset(offset)

    const responseBody = rows.map((row) => ({
      code: row.code,
      name: row.name,
      category: row.category,
      description: row.description,
    }))

    return c.json(responseBody, 200)
  },
)
