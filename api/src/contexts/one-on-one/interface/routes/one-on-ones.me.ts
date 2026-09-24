import { OneOnOneRepository } from "@/contexts/one-on-one/infrastructure/repositories/oneonone/one-on-one.repository"
import { UnexpectedError } from "@/lib/errors"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppOneOnOneList } from "@/contexts/one-on-one/interface/http/response-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { readCompanyEmployeeProfiles } from "@/contexts/company/interface/operations/read-company-employee-profiles"
import { oneOnOnes } from "@/contexts/one-on-one/infrastructure/schema/one-on-one"
import { count, eq, or } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /oneonone/me — 本人が参加した 1on1 の履歴（参加者名込み、開催日時の降順） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
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

  const oneOnOnesList = await (async () => {
    const command = {
      employeeId: viewer.employeeId,
      limit,
      offset,
    }

    const oneOnOneRepository = new OneOnOneRepository(c)

    const oneOnOnes = await oneOnOneRepository.findByParticipantId(command.employeeId, {
      limit: command.limit,
      offset: command.offset,
    })

    if (oneOnOnes instanceof Error) {
      return new UnexpectedError("failed to find one-on-ones", { cause: oneOnOnes })
    }

    return oneOnOnes
  })()

  if (oneOnOnesList instanceof ApplicationError) {
    throw toHttpException(oneOnOnesList)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(oneOnOnes)
    .where(
      or(eq(oneOnOnes.memberId, viewer.employeeId), eq(oneOnOnes.managerId, viewer.employeeId)),
    )

  const profiles = await readCompanyEmployeeProfiles({
    database: c.env.DB,
    employeeIds: oneOnOnesList.flatMap((oneOnOne) => [oneOnOne.memberId, oneOnOne.managerId]),
    now: c.env.NOW,
    timeZone: c.env.COMPANY_TIME_ZONE,
  })
  if (profiles instanceof Error) throw profiles

  const responseBody = zAppOneOnOneList.parse({
    data: oneOnOnesList.map((oneOnOne) => {
      return {
        id: oneOnOne.id,
        held_at: oneOnOne.heldAt,
        member_name: profiles.get(oneOnOne.memberId)?.officialName ?? "",
        manager_name: profiles.get(oneOnOne.managerId)?.officialName ?? "",
        topics: oneOnOne.topics,
        manager_note: viewer.employeeId === oneOnOne.managerId ? oneOnOne.managerNote : null,
        next_action: oneOnOne.nextAction,
      }
    }),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
