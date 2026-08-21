import { RegisterPartner } from "@/contexts/partner/application/register-partner"
import { factory } from "@/api/http/factory"
import { likeKeyword } from "@/lib/database/like-keyword"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { partners } from "@/contexts/partner/infrastructure/schema/partner"
import { and, asc, count, eq, or } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppPartner, zAppPartnerList } from "@/lib/app-schemas"
import { codeSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /partners — キーワード・status で絞り込める取引先一覧（台帳は社内公開） */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      q: z.string().optional(),
      status: z.enum(["active", "archived"]).optional(),
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

    const conditions: Array<SQL> = []

    if (query.q !== undefined && query.q !== "") {
      const keywordCondition = or(
        likeKeyword(partners.name, query.q),
        likeKeyword(partners.code, query.q),
      )

      if (keywordCondition !== undefined) {
        conditions.push(keywordCondition)
      }
    }

    if (query.status !== undefined) {
      conditions.push(eq(partners.status, query.status))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const rows = await c.var.database
      .select()
      .from(partners)
      .where(where)
      .orderBy(asc(partners.code))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database.select({ total: count() }).from(partners).where(where)

    const responseBody = zAppPartnerList.parse({
      data: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        category: row.category,
        corporate_number: row.corporateNumber,
        note: row.note,
        status: row.status,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** POST /partners — 新規取引先の登録（partner:manage） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
      name: z.string().min(1).max(200),
      category: z.enum(["customer", "supplier", "other"]).optional(),
      corporate_number: z.string().max(200).optional(),
      note: z.string().max(3_000).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new RegisterPartner(c).run({
      session: session,
      partner: {
        code: json.code,
        name: json.name,
        category: json.category ?? null,
        corporateNumber: json.corporate_number ?? null,
        note: json.note ?? null,
      },
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppPartner.parse({
      id: created.id,
      code: created.code,
      name: created.name,
      category: created.category,
      corporate_number: created.corporateNumber,
      note: created.note,
      status: created.status,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
