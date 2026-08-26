import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { CompanyBootstrapAdapter } from "@/contexts/company/infrastructure/adapters/employee/company-bootstrap.adapter"
import {
  CompanyAccessDeniedError,
  CompanyAuthenticationRequiredError,
  CompanyBootstrapConflictError,
  CompanyBootstrapInputInvalidError,
  CompanyBootstrapUnavailableError,
  CompanyDatabaseUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - APIが認証済みSystem rootをCompany Actorへ変換しcompany:adminを検査する
export const POST = factory.createHandlers(
  zValidator(
    "json",
    z
      .object({
        name: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .refine((value) => !value.includes("\0")),
        code: z.string().trim().min(1).max(64).optional(),
        organization_name: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .refine((value) => !value.includes("\0"))
          .optional(),
      })
      .strict(),
    (validation) => {
      if (!validation.success) {
        throw new CompanyBootstrapInputInvalidError(validation.error)
      }
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) {
      throw new CompanyAuthenticationRequiredError()
    }
    if (!actor.hasCapability("company:admin")) {
      throw new CompanyAccessDeniedError()
    }

    const database = context.env.DB
    if (database === undefined) {
      throw new CompanyDatabaseUnavailableError()
    }
    const clock = context.var.companyClock
    if (clock === undefined) {
      throw new CompanyBootstrapUnavailableError(new Error("Company clock is unavailable"))
    }

    const now = clock()
    const companyEnvironment = context.env as typeof context.env & {
      COMPANY_TIME_ZONE?: string
    }
    const effectiveOn = resolveCompanyBusinessDate({
      now: now.toISOString(),
      timeZone: companyEnvironment.COMPANY_TIME_ZONE,
    })
    if (typeof effectiveOn !== "string") {
      throw new CompanyBootstrapUnavailableError(effectiveOn)
    }

    const body = context.req.valid("json")
    const result = await new CompanyBootstrapAdapter(database).provision({
      accountId: actor.accountId,
      employeeCode: body.code ?? "E001",
      employeeName: body.name,
      organizationName: body.organization_name ?? "Company",
      effectiveOn,
      occurredAt: now,
    })
    if (result instanceof Error) {
      throw new CompanyBootstrapUnavailableError(result)
    }
    if (result.state === "company_exists_without_account_link") {
      throw new CompanyBootstrapConflictError("company_bootstrap_conflict")
    }
    if (result.state === "already_initialized") {
      throw new CompanyBootstrapConflictError("already_initialized")
    }
    if (result.employeeId === null) {
      throw new CompanyBootstrapUnavailableError()
    }

    return context.json({ account_id: actor.accountId, employee_id: result.employeeId }, 201)
  },
)
