import { hasCompanyCapability } from "@/contexts/company/application/core/has-company-capability"
import { updateOrganizationProfile } from "@/contexts/company/application/organization/update-organization-profile"
import { readOrganizationProfileFromD1 } from "@/contexts/company/infrastructure/organization/read-organization-profile-from-d1"
import { writeOrganizationProfileToD1 } from "@/contexts/company/infrastructure/organization/write-organization-profile-to-d1"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyInvalidOrganizationProfileError,
  CompanyOrganizationAmbiguousError,
  CompanyOrganizationProfileNotConfiguredError,
  CompanyOrganizationProfileReadFailedError,
  CompanyOrganizationProfileWriteFailedError,
  CompanyReadForbiddenError,
  CompanyWriteForbiddenError,
} from "@/contexts/company/interface/errors"
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
    throw new CompanyAuthenticationRequiredError()
  }
  if (!hasCompanyCapability(actor, "company:read")) {
    throw new CompanyReadForbiddenError()
  }
  if (actor.organizationIds.length !== 1) {
    throw new CompanyOrganizationAmbiguousError()
  }
  const database = context.env.DB
  if (database === undefined) {
    throw new CompanyDatabaseUnavailableError()
  }
  const result = await readOrganizationProfileFromD1(database, actor.organizationIds[0])
  if (result instanceof Error) {
    throw new CompanyOrganizationProfileReadFailedError({ cause: result })
  }
  if (result === null) {
    throw new CompanyOrganizationProfileNotConfiguredError()
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
        throw new CompanyInvalidOrganizationProfileError({ cause: validation.error })
      }
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) {
      throw new CompanyAuthenticationRequiredError()
    }
    if (actor.organizationIds.length !== 1) {
      throw new CompanyOrganizationAmbiguousError()
    }
    const database = context.env.DB
    if (database === undefined) {
      throw new CompanyDatabaseUnavailableError()
    }
    const result = await updateOrganizationProfile(actor, context.req.valid("json"), (profile) =>
      writeOrganizationProfileToD1(database, actor.organizationIds[0], profile),
    )
    if (result instanceof ApplicationForbiddenError) {
      throw new CompanyWriteForbiddenError({ cause: result })
    }
    if (result instanceof Error) {
      throw new CompanyOrganizationProfileWriteFailedError({ cause: result })
    }
    return context.json({ name: result.name, representativeName: result.representativeName })
  },
)
