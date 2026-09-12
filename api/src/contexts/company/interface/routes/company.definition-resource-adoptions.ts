import { ApplyDefinitionResourceAdoption } from "@/contexts/company/application/definitions/apply-definition-resource-adoption"
import { CompanyNotFoundError, CompanyOperationError } from "@/contexts/company/domain/errors"
import { DefinitionResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/definitions/definition-resource-adoption-snapshot.adapter"
import { DefinitionResourceAdoptionRepository } from "@/contexts/company/infrastructure/repositories/definitions/definition-resource-adoption.repository"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import {
  CompanyAuthenticationRequiredError,
  CompanyAccessDeniedError,
  CompanyDatabaseUnavailableError,
  CompanyReadUnavailableError,
  CompanyQueryInvalidError,
  CompanyBodyInvalidError,
  CompanyHeadersInvalidError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service - 既定organizationのCompany管理者が旧等級・役職の現在値を確認する
export const GET = factory.createHandlers(
  zValidator(
    "query",
    z
      .object({
        type: z.enum(["grade", "position"]),
        definition_id: z.coerce.number().int().positive(),
      })
      .strict(),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (
      !actor.canAccessOrganization("organization:default") ||
      !actor.hasCapability("company:admin")
    )
      throw new CompanyAccessDeniedError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const observedOn = resolveCompanyBusinessDate({
      now: (context.var.companyClock?.() ?? new Date()).toISOString(),
      timeZone: context.env.COMPANY_TIME_ZONE,
    })
    if (observedOn instanceof Error) throw new CompanyReadUnavailableError(observedOn)
    const snapshot = await new DefinitionResourceAdoptionSnapshotAdapter(context.env.DB).find(
      context.req.valid("query").type,
      context.req.valid("query").definition_id,
    )
    if (snapshot instanceof Error) throw new CompanyReadUnavailableError(snapshot)
    if (snapshot === null)
      throw toHttpException(
        new CompanyNotFoundError("定義が見つかりません", "definition_not_found"),
      )
    return context.json({
      snapshot: snapshot.props.value,
      snapshotDigest: snapshot.props.digest,
      expectedRevision: snapshot.props.value.organizationRevision,
      observedOn,
    })
  },
)

// @authorization service - Company管理者が確認した旧等級・役職を公開履歴へ接続する
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "idempotency-key": z.string().regex(/^\S{1,200}$/) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "json",
    z
      .object({
        type: z.enum(["grade", "position"]),
        definitionId: z.number().int().positive(),
        resourceId: z.string().regex(/^\S{1,255}$/),
        expectedRevision: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER - 1),
        snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
        observedOn: z.string().date(),
        reason: z.string().trim().min(1).max(1000),
      })
      .strict(),
    (validation) => {
      if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const applied = await new ApplyDefinitionResourceAdoption({
      actor,
      repository: new DefinitionResourceAdoptionRepository({
        env: { DB: context.env.DB, COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE },
      }),
      now: context.var.companyClock?.() ?? new Date(),
    }).execute({
      ...context.req.valid("json"),
      commandId: context.req.valid("header")["idempotency-key"],
    })
    if (applied instanceof CompanyOperationError) throw toHttpException(applied)
    return context.json(applied, applied.replayed ? 200 : 201)
  },
)
