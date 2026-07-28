import { CreateDisciplinaryAction } from "@/application/disciplinary-action/create-disciplinary-action"
import { factory } from "@/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppDisciplinaryAction, zAppDisciplinaryActionList } from "@/lib/app-schemas"
import { DisciplinaryActionRepository } from "@/infrastructure/disciplinary-action/disciplinary-action-repository"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** GET /disciplinary-actions?employee_id= — 懲戒の記録一覧（disciplinary_action:read:all。本人にも開かない）。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("disciplinary_action:read:all") === false) {
    throw new ForbiddenError()
  }

  const employeeIdRaw = c.req.query("employee_id")

  const employeeId =
    employeeIdRaw === undefined || employeeIdRaw === "" ? null : Number(employeeIdRaw)

  if (employeeId !== null && (Number.isInteger(employeeId) === false || employeeId <= 0)) {
    const responseBody = zAppDisciplinaryActionList.parse({ data: [], total: 0 })

    return c.json(responseBody, 200)
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

  const repository = new DisciplinaryActionRepository(c)

  const actions = await repository.list({ employeeId, limit, offset })

  if (actions instanceof Error) {
    throw new InternalError("failed to load disciplinary actions")
  }

  const total = await repository.count(employeeId)

  if (total instanceof Error) {
    throw new InternalError("failed to count disciplinary actions")
  }

  const responseBody = zAppDisciplinaryActionList.parse({
    data: actions.map((action) => ({
      id: action.id,
      employee_id: action.employeeId,
      kind: action.kind,
      summary: action.summary,
      decided_on: action.decidedOn,
      created_at: action.createdAt,
    })),
    total,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /disciplinary-actions — 懲戒を記録（disciplinary_action:manage）。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_id: z.number().int().positive(),
      kind: z.string().min(1).max(200),
      summary: z.string().min(1).max(3_000),
      decided_on: isoDate,
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new CreateDisciplinaryAction(c).run({
      session,
      employeeId: json.employee_id,
      kind: json.kind,
      summary: json.summary,
      decidedOn: json.decided_on,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppDisciplinaryAction.parse({
      id: created.id,
      employee_id: created.employeeId,
      kind: created.kind,
      summary: created.summary,
      decided_on: created.decidedOn,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
