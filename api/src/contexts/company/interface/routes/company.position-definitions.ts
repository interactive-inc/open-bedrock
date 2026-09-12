/** /company/position-definitions */
import { PositionRepository } from "@/contexts/company/infrastructure/repositories/definitions/position.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createFactory } from "hono/factory"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization authenticated - Company認証済み主体が役職定義を読む
export const GET = factory.createHandlers(async (context) => {
  const actor = context.var.companyActor
  if (actor === undefined) throw new CompanyAuthenticationRequiredError()
  if (!actor.hasPermission("org:read")) throw new CompanyReadForbiddenError()
  if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
  const repository = new PositionRepository({
    env: { DB: context.env.DB },
    var: { database: context.var.database, auditContext: context.var.auditContext },
  })
  const [positions, total] = await Promise.all([
    repository.findMany({ limit: 100, offset: 0 }),
    repository.count(),
  ])
  if (positions instanceof Error || total instanceof Error) {
    throw new CompanyReadUnavailableError(positions instanceof Error ? positions : total)
  }
  return context.json(
    {
      data: positions.map((position) => {
        const { id, createdAt, ...props } = position.toProps()
        return { ...props, id: id!, created_at: createdAt }
      }),
      total,
    },
    200,
  )
})
