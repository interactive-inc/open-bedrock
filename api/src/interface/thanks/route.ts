import { ListThanks } from "@/application/thanks/list-thanks"
import { SendThanks } from "@/application/thanks/send-thanks"
import type { Context } from "@/env"
import {
  BadRequestError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { employees, thanks as thanksTable } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { count, inArray } from "drizzle-orm"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// GET /thanks — 全従業員が閲覧する感謝のタイムライン（新着順・ページング）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
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

  const [thanksList, totalRows] = await Promise.all([
    new ListThanks(c).run({ limit, offset }),
    c.var.database.select({ total: count() }).from(thanksTable),
  ])

  if (thanksList instanceof Error) {
    throw new InternalError("failed to load thanks")
  }

  const nameById = await toEmployeeNameMap(
    c,
    thanksList.flatMap((thanks) => [thanks.senderEmployeeId, thanks.recipientEmployeeId]),
  )

  const items = thanksList.map((thanks) => ({
    id: thanks.id,
    sender_employee_id: thanks.senderEmployeeId,
    sender_name: nameById.get(thanks.senderEmployeeId) ?? "",
    recipient_employee_id: thanks.recipientEmployeeId,
    recipient_name: nameById.get(thanks.recipientEmployeeId) ?? "",
    message: thanks.message,
    points: thanks.points,
    created_at: thanks.createdAt,
  }))

  return c.json({ data: items, total: totalRows.at(0)?.total ?? 0 }, 200)
})

// POST /thanks — 全従業員が他の従業員へ感謝を送る（受信者にだけ通知を作成）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      recipient_employee_code: codeSchema,
      message: z.string().min(1).max(1_000),
      // 任意で添えるサンクスポイント。未指定はメッセージのみの感謝。
      points: z.number().int().nonnegative().nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const result = await new SendThanks(c).run({
      senderEmployeeId: session.employeeId,
      recipientEmployeeCode: json.recipient_employee_code,
      message: json.message,
      points: json.points ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (result instanceof Error) {
      throw new InternalError("failed to send thanks")
    }

    if ("reason" in result) {
      if (result.reason === "recipient_not_found") {
        throw new NotFoundError("recipient not found")
      }

      // 送信者はセッションから解決済みのはずなので、不在は想定外の内部状態。
      if (result.reason === "sender_not_found") {
        throw new InternalError("sender not found")
      }

      if (result.reason === "self_thanks") {
        throw new BadRequestError("cannot send thanks to yourself")
      }

      if (result.reason === "insufficient_budget") {
        throw new BadRequestError("insufficient thanks point budget")
      }

      if (result.reason === "invalid_points") {
        throw new BadRequestError("invalid points")
      }

      throw new BadRequestError("invalid thanks")
    }

    const nameById = await toEmployeeNameMap(c, [
      result.senderEmployeeId,
      result.recipientEmployeeId,
    ])

    const responseBody = {
      id: result.id,
      sender_employee_id: result.senderEmployeeId,
      sender_name: nameById.get(result.senderEmployeeId) ?? "",
      recipient_employee_id: result.recipientEmployeeId,
      recipient_name: nameById.get(result.recipientEmployeeId) ?? "",
      message: result.message,
      points: result.points,
      created_at: result.createdAt,
    }

    return c.json(responseBody, 201)
  },
)

// 社員 id の配列から id→氏名 の Map を作る。
async function toEmployeeNameMap(
  c: Context,
  employeeIds: ReadonlyArray<number>,
): Promise<Map<number, string>> {
  const uniqueIds = Array.from(new Set(employeeIds))

  if (uniqueIds.length === 0) {
    return new Map()
  }

  const rows = await c.var.database
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(inArray(employees.id, uniqueIds))

  return new Map(rows.map((row) => [row.id, row.name]))
}
