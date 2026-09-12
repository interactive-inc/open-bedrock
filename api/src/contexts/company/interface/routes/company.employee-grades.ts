/** /company/employee-grades */
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { EmployeeGradeRepository } from "@/contexts/company/infrastructure/repositories/employee-history/employee-grade.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyEmployeeNotFoundError,
  CompanyQueryInvalidError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - 本人またはemployee:attributes:readで等級履歴を読む
export const GET = factory.createHandlers(
  zValidator(
    "query",
    z.object({
      employee_code: z.string().trim().min(1).max(64),
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
    const employee = await new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: context.env.DB,
        COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
        ...(context.var.companyClock === undefined
          ? {}
          : { NOW: context.var.companyClock().toISOString() }),
      },
    }).findByCode(query.employee_code)
    if (employee instanceof Error) throw new CompanyReadUnavailableError(employee)
    if (employee === null) {
      throw new CompanyEmployeeNotFoundError()
    }
    if (actor.employeeId !== employee.id && !actor.hasPermission("employee:attributes:read")) {
      throw new CompanyReadForbiddenError()
    }
    const repository = new EmployeeGradeRepository({
      env: { DB: context.env.DB },
      var: { database: context.var.database, auditContext: context.var.auditContext },
    })
    const [grades, total] = await Promise.all([
      repository.findMany({
        employeeId: employee.id,
        limit: query.limit,
        offset: query.offset,
      }),
      repository.countByEmployeeId(employee.id),
    ])
    if (grades instanceof Error || total instanceof Error) {
      throw new CompanyReadUnavailableError(grades instanceof Error ? grades : total)
    }
    return context.json(
      {
        data: grades.map((grade) => {
          const props = grade.toProps()
          return {
            id: props.id!,
            employee_id: props.employeeId,
            grade_id: props.gradeId,
            effective_date: props.effectiveDate,
            reason: props.reason,
            created_at: props.createdAt,
          }
        }),
        total,
      },
      200,
    )
  },
)
