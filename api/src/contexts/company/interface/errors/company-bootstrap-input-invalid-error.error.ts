import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyBootstrapInputInvalidError extends CompanyHTTPException {
  constructor(cause?: unknown) {
    super({
      status: 400,
      code: "invalid_company_bootstrap_input",
      detail: "Company bootstrap request body is invalid",
      cause,
    })
  }
}
