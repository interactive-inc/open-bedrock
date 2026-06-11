import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { assets } from "@/schema"
import { and, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// GET /assets — kind / status で絞り込める資産一覧
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
      .limit(limit)
      .offset(offset)

    const responseBody = rows.map((row) => ({
      code: row.code,
      name: row.name,
      kind: row.kind,
      serial: row.serial,
      purchased_on: row.purchasedOn,
      status: row.status,
      holder_employee_id: row.holderEmployeeId,
    }))

    return c.json(responseBody, 200)
  },
)
