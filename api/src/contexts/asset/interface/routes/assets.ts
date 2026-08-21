import { RegisterAsset } from "@/contexts/asset/application/register-asset"
import { assets } from "@/contexts/asset/infrastructure/schema/asset"
import { toAssetResponse } from "@/contexts/asset/interface/http/assets/to-asset-response"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { zAppAsset, zAppAssetList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { codeSchema, isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, eq, type SQL } from "drizzle-orm"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /assets — 新規資産の登録（権限が必要） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
      name: z.string().min(1).max(200),
      kind: z.enum(["pc", "monitor", "furniture", "other"]),
      serial: z.string().max(200).optional(),
      purchased_on: isoDate.optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new RegisterAsset(c).run({
      session: session,
      asset: {
        code: json.code,
        name: json.name,
        kind: json.kind,
        serial: json.serial ?? null,
        purchasedOn: json.purchased_on ?? null,
      },
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppAsset.parse({
      code: created.code,
      name: created.name,
      kind: created.kind,
      serial: created.serial,
      purchased_on: created.purchasedOn,
      status: created.status,
      holder_employee_id: created.holderEmployeeId,
    })

    return c.json(responseBody, 201)
  },
)

// @authorization authenticated - ログインしていれば誰でも読める共有データ
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
