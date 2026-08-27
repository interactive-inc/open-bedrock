/** /company/my-profile */
import { UpdateEmployeePhone } from "@/contexts/company/application/employees/update-employee-phone"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { EmployeeRepository } from "@/contexts/company/infrastructure/repositories/employee/employee.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyDatabaseUnavailableError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization owner - 本人のCompany連絡先だけを更新する
export const PUT = factory.createHandlers(
  zValidator(
    "json",
    z.object({ phone: z.string().trim().min(1).max(64).nullable() }),
    (validation) => {
      if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const result = await new UpdateEmployeePhone({
      actor,
      repository: new EmployeeRepository({
        env: { DB: context.env.DB },
        var: { database: context.var.database, auditContext: context.var.auditContext },
      }),
      now: context.var.companyClock?.() ?? new Date(),
    }).execute(context.req.valid("json").phone)
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.json({ phone: result.phone }, 200)
  },
)
