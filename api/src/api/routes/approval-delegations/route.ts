import {
  BadRequestError,
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { resolveLiveEmployeeAccess } from "@/contexts/company/application/auth/resolve-live-employee-access"
import { resolveActiveSystemAccountId } from "@/contexts/company/application/iam/to-system-account-id"
import {
  resolveCompanyAccountParticipants,
  resolveSystemAccountIdsForEmployees,
} from "@/contexts/company/application/iam/resolve-company-account-participants"
import { loadSystemProcedure } from "@/api/routes/application-templates/lib/system-procedure-route"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { SystemD1ProcedureDelegationRepository } from "@system/infrastructure/workflow/system-d1-procedure-delegation-repository"
import type { Context } from "@/env"

const delegationSchema = z.object({
  delegate_employee_code: z.string().min(1).max(64),
  template_code: z.string().min(1).max(64).nullable().default(null),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
})

function repository(c: Context): SystemD1ProcedureDelegationRepository {
  return new SystemD1ProcedureDelegationRepository({ env: { DB: c.env.DB } })
}

// @authorization owner - 本人が委任元または委任先の記録だけを読む
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const accountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (accountId instanceof Error) throw new InternalError("failed to resolve canonical actor")
  const rows = await repository(c).list(accountId)
  if (rows instanceof Error) throw new InternalError("failed to list delegations")
  const participants = await resolveCompanyAccountParticipants(
    c,
    rows.flatMap((row) => [row.delegatorAccountId, row.delegateAccountId]),
  )
  if (participants instanceof Error) throw new InternalError("failed to resolve delegation actors")
  const byAccount = new Map(participants.map((participant) => [participant.accountId, participant]))

  return c.json(
    {
      data: rows.map((row) => {
        const delegator = byAccount.get(row.delegatorAccountId)
        const delegate = byAccount.get(row.delegateAccountId)
        return {
          id: row.number,
          delegator:
            delegator === undefined
              ? null
              : {
                  id: delegator.employeeId,
                  code: delegator.employeeCode,
                  name: delegator.employeeName,
                },
          delegate:
            delegate === undefined
              ? null
              : {
                  id: delegate.employeeId,
                  code: delegate.employeeCode,
                  name: delegate.employeeName,
                },
          template_code: row.procedureKey,
          starts_at: row.startsAt.toISOString(),
          ends_at: row.endsAt.toISOString(),
          cancelled_at: row.revokedAt?.toISOString() ?? null,
          created_at: row.createdAt.toISOString(),
          can_delete: row.delegatorAccountId === accountId && row.revokedAt === null,
        }
      }),
    },
    200,
  )
})

// @authorization owner - 本人の判断資格だけを有効なCompany主体へ委任する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", delegationSchema),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const body = c.req.valid("json")
    const startsAt = new Date(body.starts_at)
    const endsAt = new Date(body.ends_at)
    const createdAt = new Date(c.env.NOW ?? Date.now())
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestError("ends_at must be later than starts_at")
    }
    if (startsAt.getTime() < createdAt.getTime()) {
      throw new BadRequestError("starts_at must not be earlier than created_at")
    }
    const delegate = await c.var.database
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.code, body.delegate_employee_code))
      .limit(1)
      .then((rows) => rows.at(0))
    if (delegate === undefined) throw new NotFoundError("active delegate employee not found")
    const delegateAccess = await resolveLiveEmployeeAccess(c, delegate.id)
    if (delegateAccess instanceof ApplicationError) throw toHttpException(delegateAccess)
    if (delegateAccess === null) throw new NotFoundError("active delegate employee not found")
    if (delegate.id === session.employeeId) {
      throw new BadRequestError("cannot delegate approval to yourself")
    }
    const delegateAccountIds = await resolveSystemAccountIdsForEmployees(c, [delegate.id])
    if (delegateAccountIds instanceof Error || delegateAccountIds.length !== 1) {
      throw new NotFoundError("active delegate employee not found")
    }
    const delegateAccountId = delegateAccountIds[0]
    if (delegateAccountId === undefined) {
      throw new NotFoundError("active delegate employee not found")
    }
    const delegatorAccountId = await resolveActiveSystemAccountId(c, session.accountId)
    if (delegatorAccountId instanceof Error) {
      throw new InternalError("failed to resolve canonical delegation actor")
    }
    let procedureKey = null
    if (body.template_code !== null) {
      const procedure = await loadSystemProcedure(c, body.template_code)
      if (procedure instanceof Error) throw new InternalError("failed to load template")
      if (procedure === null) throw new NotFoundError("application template not found")
      procedureKey = procedure.key
    }
    const created = await repository(c).create({
      delegatorAccountId,
      delegateAccountId,
      procedureKey,
      startsAt,
      endsAt,
      createdAt,
    })
    if (created === "overlap") throw new ConflictError("delegation period overlaps")
    if (created instanceof Error) throw new InternalError("failed to create delegation")

    return c.json(
      {
        id: created.number,
        delegate_employee_code: body.delegate_employee_code,
        template_code: created.procedureKey,
        starts_at: created.startsAt.toISOString(),
        ends_at: created.endsAt.toISOString(),
        created_at: created.createdAt.toISOString(),
      },
      201,
    )
  },
)
