import { CreateOneOnOne } from "@/application/oneonone/create-one-on-one"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppOneOnOne, zAppOneOnOneList } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { employees, oneOnOnes } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { aliasedTable, count, desc, eq, or } from "drizzle-orm"
import { z } from "zod"

const members = aliasedTable(employees, "members")

const managers = aliasedTable(employees, "managers")

/** GET /oneonone — 本人が参加した 1on1 の履歴（参加者名込み） */
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

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(oneOnOnes)
    .where(
      or(eq(oneOnOnes.memberId, session.employeeId), eq(oneOnOnes.managerId, session.employeeId)),
    )

  const responseBody = zAppOneOnOneList.parse({
    data: rows.map((row) => ({
      id: row.oneOnOne.id,
      held_at: row.oneOnOne.heldAt,
      member_name: row.memberName ?? "",
      manager_name: row.managerName ?? "",
      topics: row.oneOnOne.topics,
      manager_note: session.employeeId === row.oneOnOne.managerId ? row.oneOnOne.managerNote : null,
      next_action: row.oneOnOne.nextAction,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

/** POST /oneonone — マネージャーが 1on1 を記録する */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        member_employee_code: z.string().min(1).max(100).optional(),
        member_email: z.string().min(1).max(254).optional(),
        topics: z.string().max(5_000).nullable().optional(),
        manager_note: z.string().max(5_000).nullable().optional(),
        next_action: z.string().max(5_000).nullable().optional(),
      })
      .refine(
        (body) => body.member_employee_code !== undefined || body.member_email !== undefined,
        { message: "member_employee_code or member_email is required" },
      ),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("oneonone:create") === false) {
      throw new ForbiddenError()
    }

    const json = c.req.valid("json")

    const created = await new CreateOneOnOne(c).run({
      memberCode: json.member_employee_code ?? null,
      memberEmail: json.member_email ?? null,
      managerId: session.employeeId,
      heldAt: c.env.NOW ?? new Date().toISOString(),
      topics: json.topics ?? null,
      managerNote: json.manager_note ?? null,
      nextAction: json.next_action ?? null,
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const nameRows = await c.var.database
      .select({ memberName: members.name, managerName: managers.name })
      .from(oneOnOnes)
      .leftJoin(members, eq(members.id, oneOnOnes.memberId))
      .leftJoin(managers, eq(managers.id, oneOnOnes.managerId))
      .where(eq(oneOnOnes.id, created.id))
      .limit(1)

    const nameRow = nameRows.at(0)

    const responseBody = zAppOneOnOne.parse({
      id: created.id,
      held_at: created.heldAt,
      member_name: nameRow?.memberName ?? "",
      manager_name: nameRow?.managerName ?? "",
      topics: created.topics,
      manager_note: created.managerNote,
      next_action: created.nextAction,
    })

    return c.json(responseBody, 201)
  },
)
