import { SendThanks } from "@/contexts/company/application/thanks/send-thanks"
import { Thanks } from "@/contexts/company/domain/thanks/thanks.entity"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { toEmployeeNameMap } from "@/contexts/company/interface/utils/to-employee-name-map"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { zAppThanks, zAppThanksList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { thanks as thanksTable } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { count, desc } from "drizzle-orm"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /thanks-messages — 全従業員が閲覧する感謝のタイムライン（新着順・ページング） */
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

  const [dataRows, totalRows] = await c.var.database.batch([
    c.var.database
      .select()
      .from(thanksTable)
      .orderBy(desc(thanksTable.createdAt), desc(thanksTable.id))
      .limit(limit)
      .offset(offset),
    c.var.database.select({ total: count() }).from(thanksTable),
  ])

  const thanksList = dataRows.map((row) => Thanks.fromRow(row))

  const nameById = await toEmployeeNameMap(
    c,
    thanksList.flatMap((thanks) => [thanks.senderEmployeeId, thanks.recipientEmployeeId]),
  )

  const responseBody = zAppThanksList.parse({
    data: thanksList.map((thanks) => ({
      id: thanks.id,
      sender_employee_id: thanks.senderEmployeeId,
      sender_name: nameById.get(thanks.senderEmployeeId) ?? "",
      recipient_employee_id: thanks.recipientEmployeeId,
      recipient_name: nameById.get(thanks.recipientEmployeeId) ?? "",
      message: thanks.message,
      points: thanks.points,
      created_at: thanks.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

// @authorization owner - 本人のリソースに限定する
/** POST /thanks-messages — 全従業員が他の従業員へ感謝を送る（受信者にだけ通知を作成） */
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

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    let nameById: Map<number, string>

    try {
      nameById = await toEmployeeNameMap(c, [result.senderEmployeeId, result.recipientEmployeeId])
    } catch {
      // names 取得失敗でも thanks は保存済みなので 201 を返す
      nameById = new Map()
    }

    const responseBody = zAppThanks.parse({
      id: result.id,
      sender_employee_id: result.senderEmployeeId,
      sender_name: nameById.get(result.senderEmployeeId) ?? "",
      recipient_employee_id: result.recipientEmployeeId,
      recipient_name: nameById.get(result.recipientEmployeeId) ?? "",
      message: result.message,
      points: result.points,
      created_at: result.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
