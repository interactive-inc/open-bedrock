import { CreateShiftSwapRequest } from "@/application/shift/create-shift-swap-request"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppShiftSwapRequest, zAppShiftSwapRequestPendingList } from "@/lib/app-schemas"
import { canApproveShiftSwap } from "@/lib/shift/can-approve-shift-swap"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { employees, shiftSwapRequests } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { count, eq } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// GET /shift/swap-requests — 承認権限者向けの保留中のシフト交代申請一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canApproveShiftSwap(session.role) === false) {
    throw new ForbiddenError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const requester = alias(employees, "requester")
  const target = alias(employees, "target")

  const rows = await c.var.database
    .select({
      swapRequest: shiftSwapRequests,
      requesterCode: requester.code,
      targetCode: target.code,
    })
    .from(shiftSwapRequests)
    .leftJoin(requester, eq(requester.id, shiftSwapRequests.requesterEmployeeId))
    .leftJoin(target, eq(target.id, shiftSwapRequests.targetEmployeeId))
    .where(eq(shiftSwapRequests.status, "pending"))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(shiftSwapRequests)
    .where(eq(shiftSwapRequests.status, "pending"))

  const responseBody = zAppShiftSwapRequestPendingList.parse({
    data: rows.map((row) => ({
      id: row.swapRequest.id,
      requester_employee_code: row.requesterCode ?? "",
      target_employee_code: row.targetCode ?? "",
      date: row.swapRequest.date,
      note: row.swapRequest.note,
      status: row.swapRequest.status,
      approved_at: row.swapRequest.approvedAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

// POST /shift/swap-requests — 認証された本人がシフト交代を申請する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      target_employee_code: codeSchema,
      date: isoDate,
      note: z.string().max(3_000).optional(),
    }),
  ),
  async (c) => {
    const request = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const swapRequest = await new CreateShiftSwapRequest(c).run({
      requesterEmployeeId: session.employeeId,
      targetEmployeeCode: request.target_employee_code,
      date: request.date,
      note: request.note ?? null,
    })

    if (swapRequest instanceof ApplicationError) {
      throw toHttpException(swapRequest)
    }

    const responseBody = zAppShiftSwapRequest.parse({
      id: swapRequest.id,
      requester_employee_id: swapRequest.requesterEmployeeId,
      target_employee_id: swapRequest.targetEmployeeId,
      date: swapRequest.date,
      note: swapRequest.note,
      status: swapRequest.status,
      approved_at: swapRequest.approvedAt,
    })

    return c.json(responseBody, 201)
  },
)
