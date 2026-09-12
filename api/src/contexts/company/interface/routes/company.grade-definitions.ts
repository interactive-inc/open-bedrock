/** /company/grade-definitions */
import { GradeRepository } from "@/contexts/company/infrastructure/repositories/definitions/grade.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createFactory } from "hono/factory"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization authenticated - Company認証済み主体が等級定義を読む
export const GET = factory.createHandlers(async (context) => {
  const actor = context.var.companyActor
  if (actor === undefined) throw new CompanyAuthenticationRequiredError()
  if (!actor.hasPermission("org:read")) throw new CompanyReadForbiddenError()
  if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
  const repository = new GradeRepository({
    env: { DB: context.env.DB },
    var: { database: context.var.database, auditContext: context.var.auditContext },
  })
  const [grades, total] = await Promise.all([
    repository.findMany({ limit: 100, offset: 0 }),
    repository.count(),
  ])
  if (grades instanceof Error || total instanceof Error) {
    throw new CompanyReadUnavailableError(grades instanceof Error ? grades : total)
  }
  return context.json(
    {
      data: grades.map((grade) => {
        const { id, createdAt, ...props } = grade.toProps()
        return { ...props, id: id!, created_at: createdAt }
      }),
      total,
    },
    200,
  )
})
