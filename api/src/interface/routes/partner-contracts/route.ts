import { CreateContract } from "@/application/contract/create-contract"
import { factory } from "@/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { contracts } from "@/schema"
import { and, asc, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ApplicationError } from "@/lib/errors"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppContract, zAppContractList } from "@/lib/app-schemas"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 並び順ホワイトリスト。renewal_near は更新期限が近い順（NULL は末尾）。 */
const SORT_OPTIONS = {
  contract_date_desc: desc(contracts.contractDate),
  contract_date_asc: asc(contracts.contractDate),
  renewal_near: asc(contracts.renewalDeadline),
} as const

type SortKey = keyof typeof SORT_OPTIONS

// @authorization permission - 権限キーで判定する
/**
 * GET /partner-contracts — 全社の契約記録を横断で閲覧する（contract:read:all）。
 * フィルタ: partner_id。order: 期限切れ間近（renewal_near）ほか。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      partner_id: z.string().optional(),
      order: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("contract:read:all") === false) {
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

    if (query.partner_id !== undefined && query.partner_id !== "") {
      const partnerId = Number(query.partner_id)

      if (Number.isInteger(partnerId)) {
        conditions.push(eq(contracts.partnerId, partnerId))
      }
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const order = query.order ?? ""

    const sortKey: SortKey = order in SORT_OPTIONS ? (order as SortKey) : "contract_date_desc"

    const rows = await c.var.database
      .select()
      .from(contracts)
      .where(where)
      .orderBy(SORT_OPTIONS[sortKey])
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database.select({ total: count() }).from(contracts).where(where)

    const responseBody = zAppContractList.parse({
      data: rows.map((row) => ({
        id: row.id,
        partner_id: row.partnerId,
        title: row.title,
        contract_date: row.contractDate,
        starts_on: row.startsOn,
        ends_on: row.endsOn,
        renewal_deadline: row.renewalDeadline,
        note: row.note,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** POST /partner-contracts — 契約記録の新規作成（contract:manage） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      partner_id: z.number().int().positive(),
      title: z.string().min(1).max(500),
      contract_date: isoDate,
      starts_on: isoDate.optional(),
      ends_on: isoDate.optional(),
      renewal_deadline: isoDate.optional(),
      note: z.string().max(3_000).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new CreateContract(c).run({
      session: session,
      contract: {
        partnerId: json.partner_id,
        title: json.title,
        contractDate: json.contract_date,
        startsOn: json.starts_on ?? null,
        endsOn: json.ends_on ?? null,
        renewalDeadline: json.renewal_deadline ?? null,
        note: json.note ?? null,
      },
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppContract.parse({
      id: created.id,
      partner_id: created.partnerId,
      title: created.title,
      contract_date: created.contractDate,
      starts_on: created.startsOn,
      ends_on: created.endsOn,
      renewal_deadline: created.renewalDeadline,
      note: created.note,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
