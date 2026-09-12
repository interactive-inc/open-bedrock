import { ApplyGradeAwardArchive } from "@/contexts/company/application/definitions/apply-grade-award-archive"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { GradeAwardSourceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/definitions/grade-award-source-snapshot.adapter"
import { GradeAwardArchiveRepository } from "@/contexts/company/infrastructure/repositories/definitions/grade-award-archive.repository"
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

// @authorization service - Company管理者が原記録の保全対象を確認する。過去の等級決定は行わない
export const GET = factory.createHandlers(
  zValidator(
    "query",
    z.strictObject({ employee_id: z.string().regex(/^\S{1,128}$/) }),
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
    const snapshot = await new GradeAwardSourceSnapshotAdapter(context.env.DB).find(
      context.req.valid("query").employee_id,
    )
    if (snapshot instanceof CompanyOperationError) throw toHttpException(snapshot)
    if (snapshot instanceof Error) throw new CompanyReadUnavailableError(snapshot)
    return context.json({
      snapshot: snapshot.props.value,
      snapshotDigest: snapshot.props.digest,
      expectedRevision: snapshot.props.value.organizationRevision,
      observedOn,
    })
  },
)

// @authorization service - Company管理者が確認した原記録を保全する
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
    z.strictObject({
      employeeId: z.string().regex(/^\S{1,128}$/),
      expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
      observedOn: z.string().date(),
      reason: z.string().trim().min(1).max(2000),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const applied = await new ApplyGradeAwardArchive({
      actor,
      repository: new GradeAwardArchiveRepository({
        env: { DB: context.env.DB, COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE },
      }),
      now: context.var.companyClock?.() ?? new Date(),
      requestAudit: context.var.auditContext,
    }).execute({
      ...context.req.valid("json"),
      commandId: context.req.valid("header")["idempotency-key"],
    })
    if (applied instanceof CompanyOperationError) throw toHttpException(applied)
    return context.json(applied, applied.replayed ? 200 : 201)
  },
)
