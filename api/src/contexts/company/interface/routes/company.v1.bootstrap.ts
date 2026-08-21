/** /company/v1/bootstrap */
import { ProvisionCompanyBootstrapEmployee } from "@/contexts/company/application/employee/provision-company-bootstrap-employee"
import { CompanyBootstrapEmployeeRepositoryD1 } from "@/contexts/company/infrastructure/employee/company-bootstrap-employee.repository"
import { CompanyHttpError } from "@/contexts/company/interface/http/errors/company-http-error"
import { zAccountId } from "@system/domain/values/account-id.schema"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission system:admin - 初期System rootに対応する最初のCompany Employeeだけを作る
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
      })
      .strict(),
    (validation) => {
      if (!validation.success) {
        throw new CompanyHttpError({
          status: 400,
          code: "invalid_company_bootstrap_input",
          detail: "Company bootstrap request body is invalid",
          cause: validation.error,
        })
      }
    },
  ),
  async (context) => {
    if (!context.var.permissions.has("system:admin")) {
      throw new CompanyHttpError({
        status: 403,
        code: "forbidden",
        detail: "System administrator permission is required",
      })
    }

    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      throw new CompanyHttpError({
        status: 503,
        code: "company_bootstrap_unavailable",
        detail: "Company bootstrap service is unavailable",
        cause: accountId.error,
      })
    }
    const body = context.req.valid("json")

    const result = await new ProvisionCompanyBootstrapEmployee({
      repository: new CompanyBootstrapEmployeeRepositoryD1({ env: { DB: context.env.DB } }),
    }).execute({
      accountId: accountId.data,
      employeeCode: body.code ?? "E001",
      name: body.name,
      now: context.var.now(),
    })
    if (result instanceof Error) {
      throw new CompanyHttpError({
        status: 503,
        code: "company_bootstrap_unavailable",
        detail: "Company bootstrap service is unavailable",
        cause: result,
      })
    }
    if (result.kind === "invalid_input") {
      throw new CompanyHttpError({
        status: 400,
        code: "invalid_company_bootstrap_input",
        detail: "Company bootstrap request body is invalid",
      })
    }
    if (result.state === "company_exists_without_account_link") {
      throw new CompanyHttpError({
        status: 409,
        code: "company_bootstrap_conflict",
        detail: "Company is already initialized without this account link",
      })
    }
    if (result.kind === "already_initialized") {
      throw new CompanyHttpError({
        status: 409,
        code: "already_initialized",
        detail: "Company is already initialized",
      })
    }

    return context.json(
      z
        .object({ account_id: z.string().min(1), employee_id: z.number().int().positive() })
        .strict()
        .parse({ account_id: accountId.data, employee_id: result.employeeId }),
      201,
    )
  },
)
