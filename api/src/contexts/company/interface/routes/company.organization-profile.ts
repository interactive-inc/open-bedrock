import { hasCompanyCapability } from "@/contexts/company/application/core/has-company-capability"
import { updateOrganizationProfile } from "@/contexts/company/application/organization/update-organization-profile"
import { readOrganizationProfileFromD1 } from "@/contexts/company/infrastructure/organization/read-organization-profile-from-d1"
import { writeOrganizationProfileToD1 } from "@/contexts/company/infrastructure/organization/write-organization-profile-to-d1"
import { CompanyHttpError } from "@/contexts/company/interface/http/errors/company-http-error"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/http/company-http-environment"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createFactory } from "hono/factory"
import { ApplicationForbiddenError } from "@/lib/errors/application-error"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - Company Actor の company:read capability で判定する
export const GET = factory.createHandlers(async (context) => {
  const actor = context.var.companyActor
  if (actor === undefined) {
    throw new CompanyHttpError({
      status: 401,
      code: "authentication_required",
      detail: "Authentication is required",
    })
  }
  if (!hasCompanyCapability(actor, "company:read")) {
    throw new CompanyHttpError({
      status: 403,
      code: "company_read_forbidden",
      detail: "Company read capability is required",
    })
  }
  if (actor.organizationIds.length !== 1) {
    throw new CompanyHttpError({
      status: 403,
      code: "company_organization_ambiguous",
      detail: "Exactly one Company organization must be selected",
    })
  }
  const database = context.env.DB
  if (database === undefined) {
    throw new CompanyHttpError({
      status: 503,
      code: "company_database_unavailable",
      detail: "Company storage is unavailable",
    })
  }
  const result = await readOrganizationProfileFromD1(database, actor.organizationIds[0])
  if (result instanceof Error) {
    throw new CompanyHttpError({
      status: 500,
      code: "organization_profile_read_failed",
      detail: "Organization profile could not be read",
      cause: result,
    })
  }
  if (result === null) {
    throw new CompanyHttpError({
      status: 404,
      code: "organization_profile_not_configured",
      detail: "Organization profile is not configured",
    })
  }
  return context.json({ name: result.name, representativeName: result.representativeName })
})

// @authorization service - Company Actor を application service に渡して判定する
export const PUT = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      name: z.string().trim().min(1).max(200),
      representativeName: z.string().trim().min(1).max(200),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyHttpError({
          status: 400,
          code: "invalid_organization_profile",
          detail: "Organization profile is invalid",
          cause: validation.error,
        })
      }
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) {
      throw new CompanyHttpError({
        status: 401,
        code: "authentication_required",
        detail: "Authentication is required",
      })
    }
    if (actor.organizationIds.length !== 1) {
      throw new CompanyHttpError({
        status: 403,
        code: "company_organization_ambiguous",
        detail: "Exactly one Company organization must be selected",
      })
    }
    const database = context.env.DB
    if (database === undefined) {
      throw new CompanyHttpError({
        status: 503,
        code: "company_database_unavailable",
        detail: "Company storage is unavailable",
      })
    }
    const result = await updateOrganizationProfile(actor, context.req.valid("json"), (profile) =>
      writeOrganizationProfileToD1(database, actor.organizationIds[0], profile),
    )
    if (result instanceof ApplicationForbiddenError) {
      throw new CompanyHttpError({
        status: 403,
        code: "company_write_forbidden",
        detail: "Company write capability is required",
        cause: result,
      })
    }
    if (result instanceof Error) {
      throw new CompanyHttpError({
        status: 500,
        code: "organization_profile_write_failed",
        detail: "Organization profile could not be written",
        cause: result,
      })
    }
    return context.json({ name: result.name, representativeName: result.representativeName })
  },
)
