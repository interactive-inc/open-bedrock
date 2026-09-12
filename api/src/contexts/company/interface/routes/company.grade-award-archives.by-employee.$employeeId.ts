import { CompanyNotFoundError } from "@/contexts/company/domain/errors"
import { GradeAwardArchiveRepository } from "@/contexts/company/infrastructure/repositories/definitions/grade-award-archive.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyAccessDeniedError,
  CompanyDatabaseUnavailableError,
  CompanyReadUnavailableError,
  CompanyQueryInvalidError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service - Company管理者が従業員を指定して保全済みの原記録を参照する
export const GET = factory.createHandlers(
  zValidator("param", z.object({ employeeId: z.string().regex(/^\S{1,200}$/) }), (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (
      !actor.canAccessOrganization("organization:default") ||
      !actor.hasCapability("company:admin")
    )
      throw new CompanyAccessDeniedError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const archive = await new GradeAwardArchiveRepository({
      env: { DB: context.env.DB },
    }).findByEmployee(context.req.valid("param").employeeId)
    if (archive instanceof Error) throw new CompanyReadUnavailableError(archive)
    if (archive === null)
      throw toHttpException(
        new CompanyNotFoundError("保全記録が見つかりません", "grade_award_archive_not_found"),
      )
    return context.json(archive)
  },
)
