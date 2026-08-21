import { UpdateOrganizationProfile } from "@/contexts/company/application/organization/update-organization-profile"
import { OrganizationProfileRepositoryD1 } from "@/contexts/company/infrastructure/organization/organization-profile.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyOrganizationAmbiguousError,
  CompanyOrganizationProfileInvalidError,
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
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - Company Actor の company:read capability で判定する
export const GET = factory.createHandlers(async (context) => {
  const actor = context.var.companyActor
  if (actor === undefined) {
    throw new CompanyAuthenticationRequiredError()
  }
  if (!actor.hasCapability("company:read")) {
    throw new CompanyReadForbiddenError()
  }
  if (actor.organizationIds.length !== 1) {
    throw new CompanyOrganizationAmbiguousError()
  }
  const database = context.env.DB
  if (database === undefined) {
    throw new CompanyDatabaseUnavailableError()
  }
  const result = await new OrganizationProfileRepositoryD1(database).find(actor.organizationIds[0])
  if (result instanceof Error) {
    throw new CompanyOrganizationProfileReadFailedError(result)
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
        throw new CompanyOrganizationProfileInvalidError(validation.error)
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
    const updateOrganizationProfile = new UpdateOrganizationProfile(
      actor,
      actor.organizationIds[0],
      new OrganizationProfileRepositoryD1(database),
    )
    const result = await updateOrganizationProfile.execute(context.req.valid("json"))
    if (result instanceof CompanyForbiddenError) {
      throw new CompanyWriteForbiddenError(result)
    }
    if (result instanceof Error) {
      throw new CompanyOrganizationProfileWriteFailedError(result)
    }
    return context.json({ name: result.name, representativeName: result.representativeName })
  },
)
