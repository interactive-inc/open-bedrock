/** /company/employee-events */
import { CreateEmployeeEvent } from "@/contexts/company/application/employee-history/create-employee-event"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { EmployeeEventRepository } from "@/contexts/company/infrastructure/repositories/employee-history/employee-event.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyDatabaseUnavailableError,
  CompanyEmployeeNotFoundError,
  CompanyQueryInvalidError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()
const eventKind = z.enum(["join", "transfer", "leave_of_absence", "return", "retire"])

// @authorization permission - 本人またはemployee:readで履歴を読む
export const GET = factory.createHandlers(
  zValidator(
    "query",
    z.object({
      employee_code: z.string().trim().min(1).max(64),
      kind: eventKind.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(100),
      offset: z.coerce.number().int().min(0).max(10_000).default(0),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const query = context.req.valid("query")
    const directory = new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: context.env.DB,
        COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
        ...(context.var.companyClock === undefined
          ? {}
          : { NOW: context.var.companyClock().toISOString() }),
      },
    })
    const employee = await directory.findByCode(query.employee_code)
    if (employee instanceof Error) throw new CompanyReadUnavailableError(employee)
    if (employee === null) {
      throw new CompanyEmployeeNotFoundError()
    }
    if (actor.employeeId !== employee.id && !actor.hasPermission("employee:read")) {
      throw new CompanyReadForbiddenError()
    }
    const repository = new EmployeeEventRepository({
      env: { DB: context.env.DB },
      var: { database: context.var.database, auditContext: context.var.auditContext },
    })
    const [events, total] = await Promise.all([
      repository.findMany({
        employeeId: employee.id,
        kind: query.kind ?? null,
        limit: query.limit,
        offset: query.offset,
      }),
      repository.countByEmployeeId({ employeeId: employee.id, kind: query.kind ?? null }),
    ])
    if (events instanceof Error || total instanceof Error) {
      throw new CompanyReadUnavailableError(events instanceof Error ? events : total)
    }
    return context.json(
      {
        data: events.map((event) => {
          const props = event.toProps()
          return {
            id: props.id!,
            employee_id: props.employeeId,
            kind: props.kind,
            effective_date: props.effectiveDate,
            from_department_code: props.fromDepartmentCode,
            to_department_code: props.toDepartmentCode,
            note: props.note,
            created_at: props.createdAt,
          }
        }),
        total,
      },
      200,
    )
  },
)

// @authorization permission - employee:write:attributesで履歴を追加する
export const POST = factory.createHandlers(
  zValidator(
    "json",
    z
      .object({
        employee_id: z.string().trim().min(1).max(128).optional(),
        employee_code: z.string().trim().min(1).max(64).optional(),
        kind: eventKind,
        effective_date: z.string().date(),
        from_department_code: z.string().trim().min(1).max(64).optional(),
        to_department_code: z.string().trim().min(1).max(64).optional(),
        note: z.string().trim().min(1).max(3_000).optional(),
      })
      .refine((body) => (body.employee_id === undefined) !== (body.employee_code === undefined)),
    (validation) => {
      if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const body = context.req.valid("json")
    const directory = new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: context.env.DB,
        COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
        ...(context.var.companyClock === undefined
          ? {}
          : { NOW: context.var.companyClock().toISOString() }),
      },
    })
    const employee =
      body.employee_code === undefined
        ? await directory.findById(restoreWorkforceId("employee", body.employee_id!))
        : await directory.findByCode(body.employee_code)
    if (employee instanceof Error) throw new CompanyReadUnavailableError(employee)
    if (employee === null) {
      throw new CompanyEmployeeNotFoundError()
    }
    const result = await new CreateEmployeeEvent({
      actor,
      repository: new EmployeeEventRepository({
        env: { DB: context.env.DB },
        var: { database: context.var.database, auditContext: context.var.auditContext },
      }),
    }).execute({
      employeeId: employee.id,
      kind: body.kind,
      effectiveDate: body.effective_date,
      fromDepartmentCode: body.from_department_code ?? null,
      toDepartmentCode: body.to_department_code ?? null,
      note: body.note ?? null,
      createdAt: context.var.companyClock?.().toISOString() ?? new Date().toISOString(),
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    const props = result.toProps()
    return context.json(
      {
        id: props.id!,
        employee_id: props.employeeId,
        kind: props.kind,
        effective_date: props.effectiveDate,
        from_department_code: props.fromDepartmentCode,
        to_department_code: props.toDepartmentCode,
        note: props.note,
        created_at: props.createdAt,
      },
      201,
    )
  },
)
