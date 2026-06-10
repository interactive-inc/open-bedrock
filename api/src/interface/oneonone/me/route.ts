import { ListMyOneOnOnes } from "@/application/oneonone/list-my-one-on-ones"
import { factory } from "@/lib/factory"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, oneOnOnes } from "@/schema"
import { aliasedTable, eq, inArray } from "drizzle-orm"

const members = aliasedTable(employees, "members")

const managers = aliasedTable(employees, "managers")

// GET /oneonone/me — 本人が参加した 1on1 の履歴（参加者名込み、開催日時の降順）
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

  if (oneOnOnesList instanceof Error) {
    throw new InternalError("failed to load one-on-ones")
  }

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

  const responseBody = oneOnOnesList.map((oneOnOne) => {
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
  })

  return c.json(responseBody, 200)
})
