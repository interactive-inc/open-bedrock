import { DeleteOneOnOne } from "@/application/oneonone/delete-one-on-one"
import { GetOneOnOne } from "@/application/oneonone/get-one-on-one"
import { UpdateOneOnOne } from "@/application/oneonone/update-one-on-one"
import type { OneOnOne } from "@/domain/oneonone/one-on-one"
import type { Context } from "@/env"
import { factory } from "@/lib/factory"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { toResourceId } from "@/interface/shared/to-resource-id"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, oneOnOnes } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { aliasedTable, eq } from "drizzle-orm"
import { z } from "zod"

const members = aliasedTable(employees, "members")
const managers = aliasedTable(employees, "managers")
async function toResponseBody(c: Context, o: OneOnOne) {
  const nameRows = await c.var.database
    .select({ memberName: members.name, managerName: managers.name })
    .from(oneOnOnes)
    .leftJoin(members, eq(members.id, oneOnOnes.memberId))
    .leftJoin(managers, eq(managers.id, oneOnOnes.managerId))
    .where(eq(oneOnOnes.id, o.id))
    .limit(1)
  const nameRow = nameRows.at(0)
  return {
    id: o.id,
    held_at: o.heldAt,
    member_name: nameRow?.memberName ?? "",
    manager_name: nameRow?.managerName ?? "",
    topics: o.topics,
    manager_note: o.managerNote,
    next_action: o.nextAction,
  }
}

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session
  if (viewer === null) {
    throw new UnauthorizedError()
  }
  const id = toResourceId(c.req.param("id") ?? "")
  if (id === null) {
    throw new BadRequestError("invalid one-on-one id")
  }
  const o = await new GetOneOnOne(c).run({ oneOnOneId: id, viewerId: viewer.employeeId })
  if (o instanceof Error) {
    throw new InternalError("failed to load one-on-one")
  }
  if ("reason" in o) {
    if (o.reason === "one_on_one_not_found") {
      throw new NotFoundError("one-on-one not found")
    }
    throw new ForbiddenError("not a participant")
  }
  const body = await toResponseBody(c, o)
  return c.json(
    { ...body, manager_note: viewer.employeeId === o.managerId ? body.manager_note : null },
    200,
  )
})
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      topics: z.string().max(5_000).nullable().optional(),
      manager_note: z.string().max(5_000).nullable().optional(),
      next_action: z.string().max(5_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session
    if (viewer === null) {
      throw new UnauthorizedError()
    }
    const id = toResourceId(c.req.param("id") ?? "")
    if (id === null) {
      throw new BadRequestError("invalid one-on-one id")
    }
    const json = c.req.valid("json")
    const o = await new UpdateOneOnOne(c).run({
      oneOnOneId: id,
      managerId: viewer.employeeId,
      topics: json.topics ?? null,
      managerNote: json.manager_note ?? null,
      nextAction: json.next_action ?? null,
    })
    if (o instanceof Error) {
      throw new InternalError("failed to update one-on-one")
    }
    if ("reason" in o) {
      if (o.reason === "one_on_one_not_found") {
        throw new NotFoundError("one-on-one not found")
      }
      throw new ForbiddenError("not the recording manager")
    }
    return c.json(await toResponseBody(c, o), 200)
  },
)
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session
  if (viewer === null) {
    throw new UnauthorizedError()
  }
  const id = toResourceId(c.req.param("id") ?? "")
  if (id === null) {
    throw new BadRequestError("invalid one-on-one id")
  }
  const r = await new DeleteOneOnOne(c).run({ oneOnOneId: id, managerId: viewer.employeeId })
  if (r instanceof Error) {
    throw new InternalError("failed to delete one-on-one")
  }
  if (r.reason === "one_on_one_not_found") {
    throw new NotFoundError("one-on-one not found")
  }
  if (r.reason === "not_manager") {
    throw new ForbiddenError("not the recording manager")
  }
  return c.body(null, 204)
})
