import { CreateEmployeeWorkStyle } from "@/contexts/work-style/application/create-employee-work-style"
import { canReadWorkStylesOf } from "@/contexts/work-style/interface/http/employee-work-styles/can-read-work-styles-of"
import { resolveTargetEmployeeId } from "@/contexts/company-compatibility/interface/utils/resolve-target-employee-id"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppEmployeeWorkStyle, zAppEmployeeWorkStyleList } from "@/lib/app-schemas"
import { EmployeeWorkStyleRepository } from "@/contexts/work-style/infrastructure/employee-work-style-repository"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { isoDate, workStyleSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** GET /employee-work-styles?employee_id= — 従業員の勤務形態一覧（self / work_style:read:all） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const targetEmployeeId = await resolveTargetEmployeeId({
    c,
    employeeIdParam: c.req.query("employee_id"),
    employeeCodeParam: c.req.query("employee_code"),
    sessionEmployeeId: session.employeeId,
  })

  if (targetEmployeeId instanceof Error) {
    throw new InternalError("failed to resolve target employee")
  }

  if (targetEmployeeId === null) {
    throw new NotFoundError("employee not found")
  }

  if (canReadWorkStylesOf(session, targetEmployeeId) === false) {
    throw new ForbiddenError()
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

  const repository = new EmployeeWorkStyleRepository(c)

  const workStyles = await repository.findByEmployeeId({
    employeeId: targetEmployeeId,
    limit,
    offset,
  })

  if (workStyles instanceof Error) {
    throw new InternalError("failed to load work styles")
  }

  const total = await repository.countByEmployeeId(targetEmployeeId)

  if (total instanceof Error) {
    throw new InternalError("failed to count work styles")
  }

  const responseBody = zAppEmployeeWorkStyleList.parse({
    data: workStyles.map((workStyle) => ({
      id: workStyle.id,
      employee_id: workStyle.employeeId,
      style: workStyle.style,
      starts_on: workStyle.startsOn,
      ends_on: workStyle.endsOn,
      note: workStyle.note,
      created_at: workStyle.createdAt,
    })),
    total,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /employee-work-styles — 従業員の勤務形態を記録（work_style:manage） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_id: z.number().int().positive(),
      style: workStyleSchema,
      starts_on: isoDate,
      ends_on: isoDate.nullable().optional(),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const workStyle = await new CreateEmployeeWorkStyle(c).run({
      session,
      employeeId: json.employee_id,
      style: json.style,
      startsOn: json.starts_on,
      endsOn: json.ends_on ?? null,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (workStyle instanceof ApplicationError) {
      throw toHttpException(workStyle)
    }

    const responseBody = zAppEmployeeWorkStyle.parse({
      id: workStyle.id,
      employee_id: workStyle.employeeId,
      style: workStyle.style,
      starts_on: workStyle.startsOn,
      ends_on: workStyle.endsOn,
      note: workStyle.note,
      created_at: workStyle.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
