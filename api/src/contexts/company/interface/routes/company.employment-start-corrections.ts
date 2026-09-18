import { ApplyOrganizationChange } from "@/contexts/company/application/organization/apply-organization-change"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyEmploymentStartCorrectionValue } from "@/contexts/company/domain/values/company-employment-start-correction.value"
import {
  CompanySnapshotRevisionError,
  CompanyResourceValidationError,
} from "@/contexts/company/domain/errors"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyResourceHistoryRepository } from "@/contexts/company/infrastructure/repositories/core/company-resource-history.repository"
import {
  CompanyAccessDeniedError,
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyCommandConflictError,
  CompanyDatabaseUnavailableError,
  CompanyEmployeeNotFoundError,
  CompanyHeadersInvalidError,
  CompanyInvariantValidationError,
  CompanyQueryInvalidError,
  CompanyReadUnavailableError,
  CompanyResourceConflictError,
  CompanyRevisionConflictError,
  CompanyWriteUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { resolveCompanyRecordedAt } from "@/contexts/company/interface/request-environment/resolve-company-recorded-at"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

/** 確認済みの原資料から雇用開始日を訂正し、後続の在籍履歴を保全する。 */
// @authorization service
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({
      "x-company-organization-id": z.literal("organization:default"),
      "idempotency-key": z.string().regex(/^\S{1,255}$/),
      "if-match": z.string().regex(/^(?:W\/)?(?:"\d+"|\d+)$/),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "json",
    z
      .object({
        employmentId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
        correctsRevision: z.number().int().positive(),
        startsOn: z.string().date(),
        reason: z.string().trim().min(1).max(2_000),
        evidenceReferences: z
          .array(
            z.strictObject({
              context: z.string().trim().min(1).max(100),
              kind: z.string().trim().min(1).max(100),
              id: z.string().trim().min(1).max(512),
              version: z.string().trim().min(1).max(255),
            }),
          )
          .min(1)
          .max(100),
      })
      .strict(),
    (validation) => {
      if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (!actor.canAccessOrganization("organization:default") || !actor.canUpdateWorkforce())
      throw new CompanyAccessDeniedError()
    const database = context.env.DB
    if (database === undefined) throw new CompanyDatabaseUnavailableError()
    const headers = context.req.valid("header")
    const body = context.req.valid("json")
    const expectedRevision = Number(headers["if-match"].replace(/^W\//, "").replace(/^"|"$/g, ""))
    if (!Number.isSafeInteger(expectedRevision))
      throw new CompanyHeadersInvalidError(new Error("Invalid revision"))

    const historyRepository = new CompanyResourceHistoryRepository(database)
    const history: Array<
      Parameters<typeof CompanyEmploymentStartCorrectionValue.create>[0]["history"][number]
    > = []
    let afterRevision = 0
    while (true) {
      const page = await historyRepository.list({
        organizationId: "organization:default",
        type: "employment",
        id: body.employmentId,
        afterRevision,
        throughRevision: expectedRevision,
        limit: 100,
      })
      if (page instanceof CompanySnapshotRevisionError) throw new CompanyQueryInvalidError(page)
      if (page instanceof Error) throw new CompanyReadUnavailableError(page)
      history.push(
        ...page.data.map(({ change, resource }) => ({
          ...resource,
          correctsRevision: change.corrects_revision,
        })),
      )
      if (!page.hasMore) break
      if (history.length >= 10_000 || page.nextAfterRevision <= afterRevision)
        throw new CompanyInvariantValidationError(
          "invalid_resource",
          new CompanyResourceValidationError("invalid_resource"),
        )
      afterRevision = page.nextAfterRevision
    }
    if (history.length === 0) throw new CompanyEmployeeNotFoundError()
    const recordedAt = resolveCompanyRecordedAt(context.var.companyClock)
    const planned = CompanyEmploymentStartCorrectionValue.create({
      history,
      correctsRevision: body.correctsRevision,
      startsOn: restoreCalendarDate(body.startsOn),
      commandId: headers["idempotency-key"],
      recordedAt,
    })
    if (planned instanceof Error) throw new CompanyInvariantValidationError(planned.code, planned)
    const result = await new ApplyOrganizationChange({
      actor,
      repository: new D1CompanyResourceRepository({ database }),
    }).execute({
      commandId: headers["idempotency-key"],
      expectedRevision,
      reason: body.reason,
      evidenceReferences: body.evidenceReferences,
      corrections: planned.corrections,
      recordedAt,
      resources: planned.resources,
    })
    if (result.kind === "forbidden") throw new CompanyAccessDeniedError()
    if (result.kind === "invalid")
      throw new CompanyInvariantValidationError(result.error.code, result.error)
    if (result.kind === "conflict")
      throw new CompanyRevisionConflictError(`"${result.actualRevision}"`)
    if (result.kind === "resource_conflict") throw new CompanyResourceConflictError()
    if (result.kind === "command_conflict") throw new CompanyCommandConflictError()
    if (result.kind === "unavailable") throw new CompanyWriteUnavailableError(result.cause)
    context.header("etag", `"${result.organizationRevision}"`)
    return context.json(
      {
        organizationId: "organization:default",
        organizationRevision: result.organizationRevision,
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201,
    )
  },
)
