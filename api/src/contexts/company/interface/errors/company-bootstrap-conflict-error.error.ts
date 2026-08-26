import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyBootstrapConflictError extends CompanyHTTPException {
  constructor(code: "already_initialized" | "company_bootstrap_conflict") {
    super({
      status: 409,
      code,
      detail:
        code === "already_initialized"
          ? "Company is already initialized"
          : "Company is already initialized without this account link",
    })
  }
}
