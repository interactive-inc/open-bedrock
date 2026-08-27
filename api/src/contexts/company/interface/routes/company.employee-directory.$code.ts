/** /company/employee-directory/:code */
import { UpdateEmployeeName } from "@/contexts/company/application/employees/update-employee-name"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { EmployeeRepository } from "@/contexts/company/infrastructure/repositories/employee/employee.repository"
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
const paramSchema = z.object({ code: z.string().trim().min(1).max(64) })

// @authorization permission - employee:readで従業員詳細を読む
export const GET = factory.createHandlers(
  zValidator("param", paramSchema, (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (!actor.hasPermission("employee:read")) throw new CompanyReadForbiddenError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const employee = await new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: context.env.DB,
        COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
        ...(context.var.companyClock === undefined
          ? {}
          : { NOW: context.var.companyClock().toISOString() }),
      },
    }).findByCode(context.req.valid("param").code)
    if (employee instanceof Error) throw new CompanyReadUnavailableError(employee)
    if (employee === null || employee.employeeCode === null) {
      throw new CompanyEmployeeNotFoundError()
    }
    return context.json(
      {
        code: employee.employeeCode,
        name: employee.officialName,
        dept_name: employee.primaryAssignment?.organizationUnitName ?? null,
        position: employee.primaryAssignment?.positionTitle ?? null,
        email: employee.email ?? "",
        status:
          employee.employment?.status === "ON_LEAVE"
            ? "leave"
            : employee.employment?.status === "TERMINATED"
              ? "retired"
              : "active",
      },
      200,
    )
  },
)

// @authorization permission - employee:write:basicをApplicationで検証する
export const PUT = factory.createHandlers(
  zValidator("param", paramSchema, (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  zValidator("json", z.object({ name: z.string().trim().min(1).max(200) }), (validation) => {
    if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
  }),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const result = await new UpdateEmployeeName({
      actor,
      repository: new EmployeeRepository({
        env: { DB: context.env.DB },
        var: { database: context.var.database, auditContext: context.var.auditContext },
      }),
      now: context.var.companyClock?.() ?? new Date(),
    }).execute({
      code: context.req.valid("param").code,
      officialName: context.req.valid("json").name,
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.json({ code: result.employeeCode, name: result.officialName }, 200)
  },
)
