import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { accounts, approvalDelegations, applicationTemplates, employees } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, asc, eq, ne, or } from "drizzle-orm"
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
        cancelled_at: row.cancelledAt,
        created_at: row.createdAt,
        can_delete: row.delegatorEmployeeId === session.employeeId && row.cancelledAt === null,
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
    const startsAt = new Date(body.starts_at).toISOString()
    const endsAt = new Date(body.ends_at).toISOString()

    if (startsAt >= endsAt) {
      throw new BadRequestError("ends_at must be later than starts_at")
    }

    const delegate = await c.var.database
      .select({ id: employees.id })
      .from(employees)
      .innerJoin(
        accounts,
        and(eq(accounts.employeeId, employees.id), eq(accounts.status, "active")),
      )
      .where(and(eq(employees.code, body.delegate_employee_code), ne(employees.status, "retired")))
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

    const createdAt = c.env.NOW ?? new Date().toISOString()
    const created = await c.env.DB.prepare(
      `INSERT INTO approval_delegations
         (delegator_employee_id, delegate_employee_id, template_code, starts_at, ends_at,
          created_by_account_id, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
       WHERE NOT EXISTS (
         SELECT 1
         FROM approval_delegations existing
         WHERE existing.delegator_employee_id = ?1
           AND existing.cancelled_at IS NULL
           AND existing.starts_at < ?5
           AND existing.ends_at > ?4
           AND (
             existing.template_code IS NULL
             OR ?3 IS NULL
             OR existing.template_code = ?3
           )
       )
       RETURNING id, template_code, starts_at, ends_at, created_at`,
    )
      .bind(
        session.employeeId,
        delegate.id,
        body.template_code,
        startsAt,
        endsAt,
        session.accountId,
        createdAt,
      )
      .first<{
        id: number
        template_code: string | null
        starts_at: string
        ends_at: string
        created_at: string
      }>()
    if (created === null) throw new ConflictError("delegation period overlaps")

    return c.json(
      {
        id: created.id,
        delegate_employee_code: body.delegate_employee_code,
        template_code: created.template_code,
        starts_at: created.starts_at,
        ends_at: created.ends_at,
        created_at: created.created_at,
      },
      201,
    )
  },
)
