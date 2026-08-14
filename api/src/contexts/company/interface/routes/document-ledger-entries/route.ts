import { RegisterDocument } from "@/contexts/company/application/document/register-document"
import { factory } from "@/contexts/company/interface/utils/factory"
import { documents } from "@/schema"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppDocument, zAppDocumentList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { and, asc, count, eq, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** GET /document-ledger-entries — 文書台帳一覧（document:read:all）。期限の近い順（期限なしは末尾）。 */
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

    if (session.hasPermission("document:read:all") === false) {
      throw new ForbiddenError()
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

    if (query.category !== undefined && query.category !== "") {
      conditions.push(eq(documents.category, query.category))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const [rows, totalRows] = await Promise.all([
      c.var.database
        .select()
        .from(documents)
        .where(where)
        // 期限なし(NULL)は末尾、期限ありは近い順。同着は id 昇順で安定化。
        .orderBy(sql`${documents.expiresOn} IS NULL`, asc(documents.expiresOn), asc(documents.id))
        .limit(limit)
        .offset(offset),
      c.var.database.select({ total: count() }).from(documents).where(where),
    ])

    const responseBody = zAppDocumentList.parse({
      data: rows.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        location: row.location,
        partner_code: row.partnerCode,
        expires_on: row.expiresOn,
        note: row.note,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** POST /document-ledger-entries — 文書台帳へ新規登録（document:manage）。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      category: z.string().max(200).nullable().optional(),
      location: z.string().min(1).max(2_000),
      partner_code: z.string().max(200).nullable().optional(),
      expires_on: z.string().max(50).nullable().optional(),
      note: z.string().max(2_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new RegisterDocument(c).run({
      session: session,
      title: json.title,
      category: json.category ?? null,
      location: json.location,
      partnerCode: json.partner_code ?? null,
      expiresOn: json.expires_on ?? null,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppDocument.parse({
      id: created.id,
      title: created.title,
      category: created.category,
      location: created.location,
      partner_code: created.partnerCode,
      expires_on: created.expiresOn,
      note: created.note,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
