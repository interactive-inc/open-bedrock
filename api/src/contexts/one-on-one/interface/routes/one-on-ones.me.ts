import { ListMyOneOnOnes } from "@/contexts/one-on-one/application/oneonone/list-my-one-on-ones"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppOneOnOneList } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { oneOnOnes } from "@/contexts/one-on-one/infrastructure/schema/one-on-one"
import { aliasedTable, count, eq, inArray, or } from "drizzle-orm"

const members = aliasedTable(employees, "members")

const managers = aliasedTable(employees, "managers")

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

  const oneOnOnesList = await new ListMyOneOnOnes(c).run({
    employeeId: viewer.employeeId,
    limit,
    offset,
  })

  if (oneOnOnesList instanceof ApplicationError) {
    throw toHttpException(oneOnOnesList)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(oneOnOnes)
    .where(
      or(eq(oneOnOnes.memberId, viewer.employeeId), eq(oneOnOnes.managerId, viewer.employeeId)),
    )

  const ids = oneOnOnesList.map((o) => o.id)

  const nameRows =
    ids.length === 0
      ? []
      : await c.var.database
          .select({ id: oneOnOnes.id, memberName: members.name, managerName: managers.name })
          .from(oneOnOnes)
          .leftJoin(members, eq(members.id, oneOnOnes.memberId))
          .leftJoin(managers, eq(managers.id, oneOnOnes.managerId))
          .where(inArray(oneOnOnes.id, ids))

  const responseBody = zAppOneOnOneList.parse({
    data: oneOnOnesList.map((oneOnOne) => {
      const nameRow = nameRows.find((row) => row.id === oneOnOne.id)

      return {
        id: oneOnOne.id,
        held_at: oneOnOne.heldAt,
        member_name: nameRow?.memberName ?? "",
        manager_name: nameRow?.managerName ?? "",
        topics: oneOnOne.topics,
        manager_note: viewer.employeeId === oneOnOne.managerId ? oneOnOne.managerNote : null,
        next_action: oneOnOne.nextAction,
      }
    }),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
