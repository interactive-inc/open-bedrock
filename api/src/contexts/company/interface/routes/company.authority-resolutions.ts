import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CreateCompanyGovernanceAuthorityResolution } from "@/contexts/company/application/organization/create-company-governance-authority-resolution"
import { ResolveActiveSystemAccountIdAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/resolve-active-system-account-id.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import {
  CompanyAccessDeniedError,
  CompanyApplicationConflictError,
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyHeadersInvalidError,
  CompanyQueryInvalidError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

const scope = z.discriminatedUnion("scope_type", [
  z
    .object({
      scope_type: z.enum(["organization-unit", "legal-entity", "site", "workplace"]),
      scope_id: z.string().regex(/^\S{1,255}$/),
    })
    .strict(),
  z
    .object({
      scope_type: z.literal("region"),
      region_code: z.string().trim().min(1).max(255),
    })
    .strict(),
  z
    .object({
      scope_type: z.literal("amount"),
      currency_code: z.string().regex(/^[A-Z]{3}$/),
      amount: z.number().finite().nonnegative(),
    })
    .strict(),
])

// @authorization service - technical permissionと分離したCompany上の責務候補をsnapshotで解決する
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "x-company-organization-id": z.string().regex(/^\S{1,255}$/) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "json",
    z
      .object({
        as_of: z.string().date(),
        subject_employee_id: z
          .string()
          .regex(/^\S{1,255}$/)
          .nullable(),
        criteria: z
          .array(
            z
              .object({
                responsibility_code: z.string().trim().min(1).max(255),
                scope: scope.nullable(),
              })
              .strict(),
          )
          .min(1)
          .max(20),
      })
      .strict(),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    const database = context.env.DB
    if (database === undefined) throw new CompanyDatabaseUnavailableError()
    const organizationId = context.req.valid("header")["x-company-organization-id"]
    if (
      (!actor.organizationIds.includes(organizationId) && !actor.organizationIds.includes("*")) ||
      (!actor.capabilities.includes("company:admin") &&
        !actor.capabilities.includes("company:read"))
    ) {
      throw new CompanyAccessDeniedError()
    }
    const body = context.req.valid("json")
    const result = await new CreateCompanyGovernanceAuthorityResolution({
      repository: new D1CompanyResourceRepository(database),
      isAccountActive: async (accountId) => {
        return new ResolveActiveSystemAccountIdAdapter({
          env: {
            DB: database,
            ...(context.env.COMPANY_TIME_ZONE === undefined
              ? {}
              : { COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE }),
            ...(context.env.NOW === undefined ? {} : { NOW: context.env.NOW }),
          },
          var: {
            database: context.var.database,
            auditContext: context.var.auditContext,
          },
        }).isActiveSystemAccount(accountId)
      },
    }).execute({
      organizationId,
      asOf: restoreCalendarDate(body.as_of),
      subjectEmployeeId: body.subject_employee_id,
      criteria: body.criteria.map((criterion) => ({
        responsibilityCode: criterion.responsibility_code,
        scope:
          criterion.scope === null
            ? null
            : criterion.scope.scope_type === "region"
              ? {
                  scopeType: "region" as const,
                  regionCode: criterion.scope.region_code,
                }
              : criterion.scope.scope_type === "amount"
                ? {
                    scopeType: "amount" as const,
                    currencyCode: criterion.scope.currency_code,
                    amount: criterion.scope.amount,
                  }
                : {
                    scopeType: criterion.scope.scope_type,
                    scopeId: criterion.scope.scope_id,
                  },
      })),
    })
    if (result.kind === "unavailable") throw new CompanyReadUnavailableError(result.cause)
    if (result.kind === "invalid") {
      throw new CompanyApplicationConflictError(result.error.code, result.error.message)
    }

    context.header("etag", `"${result.resolution.snapshot.organizationRevision}"`)
    return context.json(result.resolution, 200)
  },
)
