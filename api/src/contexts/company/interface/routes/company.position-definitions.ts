/** /company/position-definitions */
import { CreatePosition } from "@/contexts/company/application/definitions/create-position"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { PositionRepository } from "@/contexts/company/infrastructure/repositories/definitions/position.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyDatabaseUnavailableError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()
const bodySchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  rank: z.number().int(),
  description: z.string().trim().min(1).max(2_000).optional(),
})

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
    repository.findAll({ limit: 100, offset: 0 }),
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

// @authorization permission - master:org:writeで役職定義を作成する
export const POST = factory.createHandlers(
  zValidator("json", bodySchema, (validation) => {
    if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
  }),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const body = context.req.valid("json")
    const result = await new CreatePosition({
      actor,
      repository: new PositionRepository({
        env: { DB: context.env.DB },
        var: { database: context.var.database, auditContext: context.var.auditContext },
      }),
    }).execute({
      ...body,
      description: body.description ?? null,
      createdAt: context.var.companyClock?.().toISOString() ?? new Date().toISOString(),
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    const { id, createdAt, ...props } = result.toProps()
    return context.json({ ...props, id: id!, created_at: createdAt }, 201)
  },
)
