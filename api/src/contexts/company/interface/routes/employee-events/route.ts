import { CreateEmployeeEvent } from "@/application/employee-event/create-employee-event"
import { canReadEmployeeEventsOf } from "@/interface/routes/employee-events/can-read-employee-events-of"
import { resolveEmployeeRelation } from "@/contexts/company/application/organization/resolve-employee-relation"
import { resolveTargetEmployeeId } from "@/interface/utils/resolve-target-employee-id"
import { resolveEmployeeIdFromBody } from "@/interface/utils/resolve-employee-id-from-body"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppEmployeeEvent, zAppEmployeeEventList } from "@/lib/app-schemas"
import { EmployeeEventRepository } from "@/infrastructure/employee-event/employee-event-repository"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** GET /employee-events?employee_id=&kind= — 本人 or employee_event:read:all */
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

  const isViewingOthers = targetEmployeeId !== session.employeeId

  if (isViewingOthers) {
    const relation = await resolveEmployeeRelation({
      c,
      viewerEmployeeId: session.employeeId,
      targetEmployeeId,
    })

    if (relation instanceof Error) {
      throw new InternalError("failed to resolve employee relation")
    }

    if (canReadEmployeeEventsOf(session, relation) === false) {
      throw new ForbiddenError()
    }
  }

  const kind = c.req.query("kind") ?? null

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

  const repository = new EmployeeEventRepository(c)

  const events = await repository.findByEmployeeId({
    employeeId: targetEmployeeId,
    kind,
    limit,
    offset,
  })

  if (events instanceof Error) {
    throw new InternalError("failed to load employee events")
  }

  const total = await repository.countByEmployeeId({ employeeId: targetEmployeeId, kind })

  if (total instanceof Error) {
    throw new InternalError("failed to count employee events")
  }

  const responseBody = zAppEmployeeEventList.parse({
    data: events.map((event) => ({
      id: event.id,
      employee_id: event.employeeId,
      kind: event.kind,
      effective_date: event.effectiveDate,
      from_department_code: event.fromDepartmentCode,
      to_department_code: event.toDepartmentCode,
      note: event.note,
      created_at: event.createdAt,
    })),
    total,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /employee-events — 異動・在籍イベントを記録（employee_event:manage）。対象は employee_id / employee_code のいずれかで指定する */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        employee_id: z.number().int().positive().optional(),
        employee_code: z.string().min(1).max(200).optional(),
        kind: z.enum(["join", "transfer", "leave_of_absence", "return", "retire"]),
        effective_date: isoDate,
        from_department_code: z.string().max(100).nullable().optional(),
        to_department_code: z.string().max(100).nullable().optional(),
        note: z.string().max(3_000).nullable().optional(),
      })
      .refine((json) => (json.employee_id === undefined) !== (json.employee_code === undefined), {
        message: "specify exactly one of employee_id or employee_code",
      }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const targetEmployeeId = await resolveEmployeeIdFromBody({
      c,
      employeeId: json.employee_id,
      employeeCode: json.employee_code,
    })

    if (targetEmployeeId instanceof Error) {
      throw new InternalError("failed to resolve target employee")
    }

    if (targetEmployeeId === null) {
      throw new NotFoundError("employee not found")
    }

    const event = await new CreateEmployeeEvent(c).run({
      session,
      employeeId: targetEmployeeId,
      kind: json.kind,
      effectiveDate: json.effective_date,
      fromDepartmentCode: json.from_department_code ?? null,
      toDepartmentCode: json.to_department_code ?? null,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (event instanceof ApplicationError) {
      throw toHttpException(event)
    }

    const responseBody = zAppEmployeeEvent.parse({
      id: event.id,
      employee_id: event.employeeId,
      kind: event.kind,
      effective_date: event.effectiveDate,
      from_department_code: event.fromDepartmentCode,
      to_department_code: event.toDepartmentCode,
      note: event.note,
      created_at: event.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
