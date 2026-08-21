import { UnexpectedError } from "@/lib/errors"
import { ThanksRepository } from "@/contexts/thanks/infrastructure/thanks.repository"

import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { toEmployeeNameMap } from "@/api/http/utils/to-employee-name-map"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zAppThanksList } from "@/lib/app-schemas"
import { factory } from "@/api/http/factory"
import { thanks as thanksTable } from "@/contexts/thanks/infrastructure/schema/thanks"
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

  const thanksList = await (async () => {
    const props = {
      senderEmployeeId: session.employeeId,
      limit,
      offset,
    }

    const thanksRepository = new ThanksRepository(c)

    const thanksList = await thanksRepository.findBySender({
      senderEmployeeId: props.senderEmployeeId,
      limit: props.limit,
      offset: props.offset,
    })

    if (thanksList instanceof Error) {
      return new UnexpectedError("failed to find sent thanks", { cause: thanksList })
    }

    return thanksList
  })()

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
