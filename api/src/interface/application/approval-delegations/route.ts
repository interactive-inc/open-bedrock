import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { accounts, approvalDelegations, applicationTemplates, employees } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm"
import { z } from "zod"

const zDelegation = z.object({
  delegate_employee_code: z.string().min(1).max(64),
  template_code: z.string().min(1).max(64).nullable().default(null),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
})

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()

  const employeeRows = await c.var.database
    .select({ id: employees.id, code: employees.code, name: employees.name })
    .from(employees)
  const employeeById = new Map(employeeRows.map((employee) => [employee.id, employee] as const))
  const rows = await c.var.database
    .select()
    .from(approvalDelegations)
    .where(
      or(
        eq(approvalDelegations.delegatorEmployeeId, session.employeeId),
        eq(approvalDelegations.delegateEmployeeId, session.employeeId),
      ),
    )
    .orderBy(asc(approvalDelegations.startsAt))

  return c.json(
    {
      data: rows.map((row) => ({
        id: row.id,
        delegator: employeeById.get(row.delegatorEmployeeId) ?? null,
        delegate: employeeById.get(row.delegateEmployeeId) ?? null,
        template_code: row.templateCode,
        starts_at: row.startsAt,
        ends_at: row.endsAt,
        created_at: row.createdAt,
        can_delete: row.delegatorEmployeeId === session.employeeId,
      })),
    },
    200,
  )
})

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", zDelegation),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const body = c.req.valid("json")

    if (body.starts_at >= body.ends_at) {
      throw new BadRequestError("ends_at must be later than starts_at")
    }

    const delegate = await c.var.database
      .select({ id: employees.id })
      .from(employees)
      .innerJoin(
        accounts,
        and(eq(accounts.employeeId, employees.id), eq(accounts.status, "active")),
      )
      .where(eq(employees.code, body.delegate_employee_code))
      .limit(1)
      .then((rows) => rows.at(0))
    if (delegate === undefined) throw new NotFoundError("active delegate employee not found")
    if (delegate.id === session.employeeId) {
      throw new BadRequestError("cannot delegate approval to yourself")
    }

    if (body.template_code !== null) {
      const template = await c.var.database
        .select({ id: applicationTemplates.id })
        .from(applicationTemplates)
        .where(eq(applicationTemplates.code, body.template_code))
        .limit(1)
        .then((rows) => rows.at(0))
      if (template === undefined) throw new NotFoundError("application template not found")
    }

    const overlap = await c.var.database
      .select({ id: approvalDelegations.id })
      .from(approvalDelegations)
      .where(
        and(
          eq(approvalDelegations.delegatorEmployeeId, session.employeeId),
          body.template_code === null
            ? isNull(approvalDelegations.templateCode)
            : eq(approvalDelegations.templateCode, body.template_code),
          lte(approvalDelegations.startsAt, body.ends_at),
          gte(approvalDelegations.endsAt, body.starts_at),
        ),
      )
      .limit(1)
      .then((rows) => rows.at(0))
    if (overlap !== undefined) throw new ConflictError("delegation period overlaps")

    const created = await c.var.database
      .insert(approvalDelegations)
      .values({
        delegatorEmployeeId: session.employeeId,
        delegateEmployeeId: delegate.id,
        templateCode: body.template_code,
        startsAt: body.starts_at,
        endsAt: body.ends_at,
        createdAt: c.env.NOW ?? new Date().toISOString(),
      })
      .returning()
      .then((rows) => rows.at(0))
    if (created === undefined) throw new ForbiddenError("failed to create delegation")

    return c.json(
      {
        id: created.id,
        delegate_employee_code: body.delegate_employee_code,
        template_code: created.templateCode,
        starts_at: created.startsAt,
        ends_at: created.endsAt,
        created_at: created.createdAt,
      },
      201,
    )
  },
)
