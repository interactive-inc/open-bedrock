import { DeleteOneOnOne } from "@/contexts/one-on-one/application/oneonone/delete-one-on-one"
import { GetOneOnOne } from "@/contexts/one-on-one/application/oneonone/get-one-on-one"
import { UpdateOneOnOne } from "@/contexts/one-on-one/application/oneonone/update-one-on-one"
import type { OneOnOne } from "@/contexts/one-on-one/domain/oneonone/one-on-one.entity"
import type { Context } from "@/env"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppOneOnOne } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { validateUuidParam } from "@/contexts/company/interface/utils/validate-uuid-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { oneOnOnes } from "@/contexts/one-on-one/infrastructure/schema/one-on-one"
import { zValidator } from "@hono/zod-validator"
import { aliasedTable, eq } from "drizzle-orm"
import { z } from "zod"

const members = aliasedTable(employees, "members")

const managers = aliasedTable(employees, "managers")

/** 1on1 を参加者名込みの snake_case レスポンスへ整形する。名前は別クエリで解決する。 */
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

// @authorization owner - 本人のリソースに限定する
/** GET /oneonone/:id — 1on1 の詳細（参加者のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const oneOnOne = await new GetOneOnOne(c).run({
    oneOnOneId: validateUuidParam(c.req.param("id"), "one-on-one"),
    viewerId: viewer.employeeId,
  })

  if (oneOnOne instanceof ApplicationError) {
    throw toHttpException(oneOnOne)
  }

  const body = await toResponseBody(c, oneOnOne)

  const responseBody = zAppOneOnOne.parse({
    ...body,
    manager_note: viewer.employeeId === oneOnOne.managerId ? body.manager_note : null,
  })

  return c.json(responseBody, 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /oneonone/:id — 1on1 の記録内容を変更（記録した上長のみ） */
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

    if (oneOnOne instanceof ApplicationError) {
      throw toHttpException(oneOnOne)
    }

    const responseBody = zAppOneOnOne.parse(await toResponseBody(c, oneOnOne))

    return c.json(responseBody, 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /oneonone/:id — 1on1 の記録を削除（記録した上長のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteOneOnOne(c).run({
    oneOnOneId: validateUuidParam(c.req.param("id"), "one-on-one"),
    managerId: viewer.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
