import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { CompanyBootstrapRepository } from "@/contexts/company/infrastructure/employee/company-bootstrap.repository"
import {
  CompanyAccessDeniedError,
  CompanyBootstrapConflictError,
  CompanyBootstrapInputInvalidError,
  CompanyBootstrapUnavailableError,
} from "@/contexts/company/interface/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission system:admin - 空のCompanyを最初のSystem rootへ原子的に結び付ける
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
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
    if (!context.var.permissions.has("system:admin")) {
      throw new CompanyAccessDeniedError()
    }

    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      throw new CompanyBootstrapUnavailableError(accountId.error)
    }
    const now = context.var.now()
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
    const result = await new CompanyBootstrapRepository(context.env.DB).provision({
      accountId: accountId.data,
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

    return context.json({ account_id: accountId.data, employee_id: result.employeeId }, 201)
  },
)
