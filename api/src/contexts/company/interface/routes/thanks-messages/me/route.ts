import { ListMyThanks } from "@/contexts/company/application/thanks/list-my-thanks"
import { ApplicationError } from "@/lib/errors"
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
import { zAppThanksList } from "@/lib/app-schemas"
import { factory } from "@/contexts/company/interface/utils/factory"
import { thanks as thanksTable } from "@/schema"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /thanks-messages/me — 自分が送った感謝の一覧（新しい順・ページング） */
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

  const thanksList = await new ListMyThanks(c).run({
    senderEmployeeId: session.employeeId,
    limit,
    offset,
  })

  if (thanksList instanceof ApplicationError) {
    throw toHttpException(thanksList)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(thanksTable)
    .where(eq(thanksTable.senderEmployeeId, session.employeeId))

  const nameById = await toEmployeeNameMap(
    c,
    thanksList.flatMap((thanksItem) => [
      thanksItem.senderEmployeeId,
      thanksItem.recipientEmployeeId,
    ]),
  )

  const responseBody = zAppThanksList.parse({
    data: thanksList.map((thanksItem) => ({
      id: thanksItem.id,
      sender_employee_id: thanksItem.senderEmployeeId,
      sender_name: nameById.get(thanksItem.senderEmployeeId) ?? "",
      recipient_employee_id: thanksItem.recipientEmployeeId,
      recipient_name: nameById.get(thanksItem.recipientEmployeeId) ?? "",
      message: thanksItem.message,
      points: thanksItem.points,
      created_at: thanksItem.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
