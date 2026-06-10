import { CreateOneOnOne } from "@/application/oneonone/create-one-on-one"
import { canCreateOneOnOne } from "@/domain/oneonone/can-create-one-on-one"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
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
import { employees, oneOnOnes } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { aliasedTable, desc, eq, or } from "drizzle-orm"
import { z } from "zod"

const members = aliasedTable(employees, "members")

const managers = aliasedTable(employees, "managers")

// GET /oneonone — 本人が参加した 1on1 の履歴（参加者名込み）
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

  const rows = await c.var.database
    .select({ oneOnOne: oneOnOnes, memberName: members.name, managerName: managers.name })
    .from(oneOnOnes)
    .leftJoin(members, eq(members.id, oneOnOnes.memberId))
    .leftJoin(managers, eq(managers.id, oneOnOnes.managerId))
    .where(
      or(eq(oneOnOnes.memberId, session.employeeId), eq(oneOnOnes.managerId, session.employeeId)),
    )
    .orderBy(desc(oneOnOnes.heldAt))
    .limit(limit)
    .offset(offset)

  const responseBody = rows.map((row) => ({
    id: row.oneOnOne.id,
    held_at: row.oneOnOne.heldAt,
    member_name: row.memberName ?? "",
    manager_name: row.managerName ?? "",
    topics: row.oneOnOne.topics,
    manager_note: session.employeeId === row.oneOnOne.managerId ? row.oneOnOne.managerNote : null,
    next_action: row.oneOnOne.nextAction,
  }))

  return c.json(responseBody, 200)
})

// POST /oneonone — マネージャーが 1on1 を記録する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      member_email: z.string().min(1).max(254),
      topics: z.string().max(5_000).nullable().optional(),
      manager_note: z.string().max(5_000).nullable().optional(),
      next_action: z.string().max(5_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (canCreateOneOnOne(session.role) === false) {
      throw new ForbiddenError()
    }

    const json = c.req.valid("json")

    const created = await new CreateOneOnOne(c).run({
      memberEmail: json.member_email,
      managerId: session.employeeId,
      heldAt: c.env.NOW ?? new Date().toISOString(),
      topics: json.topics ?? null,
      managerNote: json.manager_note ?? null,
      nextAction: json.next_action ?? null,
    })

    if (created instanceof Error) {
      throw new InternalError("failed to create one-on-one")
    }

    if ("reason" in created) {
      if (created.reason === "self_reference") {
        throw new BadRequestError("member and manager must be different")
      }
      throw new NotFoundError("member not found")
    }

    const nameRows = await c.var.database
      .select({ memberName: members.name, managerName: managers.name })
      .from(oneOnOnes)
      .leftJoin(members, eq(members.id, oneOnOnes.memberId))
      .leftJoin(managers, eq(managers.id, oneOnOnes.managerId))
      .where(eq(oneOnOnes.id, created.id))
      .limit(1)

    const nameRow = nameRows.at(0)

    const responseBody = {
      id: created.id,
      held_at: created.heldAt,
      member_name: nameRow?.memberName ?? "",
      manager_name: nameRow?.managerName ?? "",
      topics: created.topics,
      manager_note: created.managerNote,
      next_action: created.nextAction,
    }

    return c.json(responseBody, 201)
  },
)
