import { factory } from "@/interface/utils/factory"
import { zAppAssetList } from "@/lib/app-schemas"
import { toAssetResponse } from "@/interface/routes/assets/to-asset-response"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { assets } from "@/schema"
import { and, asc, count, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** GET /assets — kind / status で絞り込める資産一覧 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      kind: z.enum(["pc", "monitor", "furniture", "other"]).optional(),
      status: z.enum(["in_stock", "lent"]).optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const validated = c.req.valid("query")

    const kind = validated.kind ?? null

    const status = validated.status ?? null

    const limit = toBoundedInt({
      raw: validated.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: validated.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const conditions: Array<SQL> = []

    if (kind !== null) {
      conditions.push(eq(assets.kind, kind))
    }

    if (status !== null) {
      conditions.push(eq(assets.status, status))
    }

    const rows = await c.var.database
      .select()
      .from(assets)
      .where(conditions.length === 0 ? undefined : and(...conditions))
      .orderBy(asc(assets.code))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(assets)
      .where(conditions.length === 0 ? undefined : and(...conditions))

    const responseBody = zAppAssetList.parse({
      data: rows.map((row) => toAssetResponse(row, session)),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
