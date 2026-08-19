/** /company/v1/bootstrap */
import { ProvisionCompanyBootstrapEmployee } from "@/contexts/company/application/employee/provision-company-bootstrap-employee"
import { CompanyBootstrapEmployeeRepositoryD1 } from "@/contexts/company/infrastructure/employee/company-bootstrap-employee-repository"
import { zAccountId } from "@system/domain/auth/account-id"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
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
  ),
  async (context) => {
    if (!context.var.permissions.has("system:admin")) {
      return context.json({ error: "forbidden", code: "forbidden" }, 403)
    }

    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      return context.json(
        { error: "Company bootstrap service unavailable", code: "company_bootstrap_unavailable" },
        503,
      )
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
      return context.json(
        { error: "Company bootstrap service unavailable", code: "company_bootstrap_unavailable" },
        503,
      )
    }
    if (result.kind === "invalid_input") {
      return context.json(
        { error: "invalid Company bootstrap input", code: "invalid_company_bootstrap_input" },
        400,
      )
    }
    if (result.state === "company_exists_without_account_link") {
      return context.json(
        { error: "Company is already initialized", code: "company_bootstrap_conflict" },
        409,
      )
    }
    if (result.kind === "already_initialized") {
      return context.json(
        { error: "Company is already initialized", code: "already_initialized" },
        409,
      )
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
