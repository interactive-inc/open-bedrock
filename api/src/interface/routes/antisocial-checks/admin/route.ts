import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppAntisocialCheckAdminList } from "@/lib/app-schemas"
import { antisocialChecks, employees } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import type { SQL } from "drizzle-orm"
import { and, count, desc, eq, ne } from "drizzle-orm"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/**
 * GET /antisocial-checks/admin — 他者から提出された反社チェックの管理受信箱。
 * 自分の申請は職務分離のため除外する。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["requested", "completed"]).optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("antisocial_check:manage") === false) {
      throw new ForbiddenError()
    }

    const query = c.req.valid("query")

    const conditions: Array<SQL> = [ne(antisocialChecks.requesterId, session.employeeId)]

    if (query.status !== undefined) {
      conditions.push(eq(antisocialChecks.status, query.status))
    }

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
      .select({ check: antisocialChecks, requesterName: employees.name })
      .from(antisocialChecks)
      .leftJoin(employees, eq(employees.id, antisocialChecks.requesterId))
      .where(and(...conditions))
      .orderBy(desc(antisocialChecks.createdAt))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(antisocialChecks)
      .where(and(...conditions))

    return c.json(
      zAppAntisocialCheckAdminList.parse({
        data: rows.map(({ check, requesterName }) => ({
          id: check.id,
          requester_id: check.requesterId,
          requester_name: requesterName ?? "",
          partner_name: check.partnerName,
          partner_address: check.partnerAddress,
          representative_name: check.representativeName,
          result: check.result,
          status: check.status,
          created_at: check.createdAt,
        })),
        total: totalRows.at(0)?.total ?? 0,
      }),
      200,
    )
  },
)
