/** /company/grade-definitions/:id */
import { DeleteGrade } from "@/contexts/company/application/definitions/delete-grade"
import { UpdateGrade } from "@/contexts/company/application/definitions/update-grade"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { GradeRepository } from "@/contexts/company/infrastructure/repositories/definitions/grade.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyDatabaseUnavailableError,
  CompanyQueryInvalidError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()
const paramSchema = z.object({ id: z.coerce.number().int().positive() })
const bodySchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  rank: z.number().int(),
  description: z.string().trim().min(1).max(2_000).optional(),
})

// @authorization permission - master:org:writeで等級定義を更新する
export const PUT = factory.createHandlers(
  zValidator("param", paramSchema, (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  zValidator("json", bodySchema, (validation) => {
    if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
  }),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const body = context.req.valid("json")
    const result = await new UpdateGrade({
      actor,
      repository: new GradeRepository({
        env: { DB: context.env.DB },
        var: { database: context.var.database, auditContext: context.var.auditContext },
      }),
    }).execute({
      id: context.req.valid("param").id,
      details: { ...body, description: body.description ?? null },
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    const { id, createdAt, ...props } = result.toProps()
    return context.json({ ...props, id: id!, created_at: createdAt }, 200)
  },
)

// @authorization permission - master:org:writeで未使用の等級定義を削除する
export const DELETE = factory.createHandlers(
  zValidator("param", paramSchema, (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const result = await new DeleteGrade({
      actor,
      repository: new GradeRepository({
        env: { DB: context.env.DB },
        var: { database: context.var.database, auditContext: context.var.auditContext },
      }),
    }).execute(context.req.valid("param").id)
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.body(null, 204)
  },
)
