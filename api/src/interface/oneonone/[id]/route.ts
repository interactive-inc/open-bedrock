import { DeleteOneOnOne } from "@/application/oneonone/delete-one-on-one"
import { GetOneOnOne } from "@/application/oneonone/get-one-on-one"
import { UpdateOneOnOne } from "@/application/oneonone/update-one-on-one"
import type { OneOnOne } from "@/domain/oneonone/one-on-one.entity"
import type { Context } from "@/env"
import { factory } from "@/lib/factory"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateUuidParam } from "@/interface/shared/validate-uuid-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, oneOnOnes } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { aliasedTable, eq } from "drizzle-orm"
import { z } from "zod"

const members = aliasedTable(employees, "members")

const managers = aliasedTable(employees, "managers")

// 1on1 を参加者名込みの snake_case レスポンスへ整形する。名前は別クエリで解決する。
async function toResponseBody(c: Context, oneOnOne: OneOnOne) {
  const nameRows = await c.var.database
    .select({ memberName: members.name, managerName: managers.name })
    .from(oneOnOnes)
    .leftJoin(members, eq(members.id, oneOnOnes.memberId))
    .leftJoin(managers, eq(managers.id, oneOnOnes.managerId))
    .where(eq(oneOnOnes.id, oneOnOne.id))
    .limit(1)

  const nameRow = nameRows.at(0)

  return {
    id: oneOnOne.id,
    held_at: oneOnOne.heldAt,
    member_name: nameRow?.memberName ?? "",
    manager_name: nameRow?.managerName ?? "",
    topics: oneOnOne.topics,
    manager_note: oneOnOne.managerNote,
    next_action: oneOnOne.nextAction,
  }
}

// GET /oneonone/:id — 1on1 の詳細（参加者のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const oneOnOne = await new GetOneOnOne(c).run({
    oneOnOneId: validateUuidParam(c.req.param("id"), "one-on-one"),
    viewerId: viewer.employeeId,
  })

  if (oneOnOne instanceof Error) {
    throw new InternalError("failed to load one-on-one")
  }

  if ("reason" in oneOnOne) {
    if (oneOnOne.reason === "one_on_one_not_found") {
      throw new NotFoundError("one-on-one not found")
    }

    throw new ForbiddenError("not a participant")
  }

  const body = await toResponseBody(c, oneOnOne)
  const safeBody = {
    ...body,
    manager_note: viewer.employeeId === oneOnOne.managerId ? body.manager_note : null,
  }
  return c.json(safeBody, 200)
})

// PUT /oneonone/:id — 1on1 の記録内容を変更（記録した上長のみ）
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

    const json = c.req.valid("json")

    const oneOnOne = await new UpdateOneOnOne(c).run({
      oneOnOneId: validateUuidParam(c.req.param("id"), "one-on-one"),
      managerId: viewer.employeeId,
      topics: json.topics ?? null,
      managerNote: json.manager_note ?? null,
      nextAction: json.next_action ?? null,
    })

    if (oneOnOne instanceof Error) {
      throw new InternalError("failed to update one-on-one")
    }

    if ("reason" in oneOnOne) {
      if (oneOnOne.reason === "one_on_one_not_found") {
        throw new NotFoundError("one-on-one not found")
      }

      throw new ForbiddenError("not the recording manager")
    }

    return c.json(await toResponseBody(c, oneOnOne), 200)
  },
)

// DELETE /oneonone/:id — 1on1 の記録を削除（記録した上長のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteOneOnOne(c).run({
    oneOnOneId: validateUuidParam(c.req.param("id"), "one-on-one"),
    managerId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete one-on-one")
  }

  if (result.reason === "one_on_one_not_found") {
    throw new NotFoundError("one-on-one not found")
  }

  if (result.reason === "not_manager") {
    throw new ForbiddenError("not the recording manager")
  }

  return c.body(null, 204)
})
