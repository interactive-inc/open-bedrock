import { ListMyOneOnOnes } from "@/application/oneonone/list-my-one-on-ones"
import { factory } from "@/lib/factory"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, oneOnOnes } from "@/schema"
import { aliasedTable, eq } from "drizzle-orm"

const members = aliasedTable(employees, "members")

const managers = aliasedTable(employees, "managers")

// GET /oneonone/me — 本人が参加した 1on1 の履歴（参加者名込み、開催日時の降順）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const oneOnOnesList = await new ListMyOneOnOnes(c).run({ employeeId: viewer.employeeId })

  if (oneOnOnesList instanceof Error) {
    throw new InternalError("failed to load one-on-ones")
  }

  const nameRows = await c.var.database
    .select({ id: oneOnOnes.id, memberName: members.name, managerName: managers.name })
    .from(oneOnOnes)
    .leftJoin(members, eq(members.id, oneOnOnes.memberId))
    .leftJoin(managers, eq(managers.id, oneOnOnes.managerId))

  const responseBody = oneOnOnesList.map((oneOnOne) => {
    const nameRow = nameRows.find((row) => row.id === oneOnOne.id)

    return {
      id: oneOnOne.id,
      held_at: oneOnOne.heldAt,
      member_name: nameRow?.memberName ?? "",
      manager_name: nameRow?.managerName ?? "",
      topics: oneOnOne.topics,
      manager_note: oneOnOne.managerNote,
      next_action: oneOnOne.nextAction,
    }
  })

  return c.json(responseBody, 200)
})
