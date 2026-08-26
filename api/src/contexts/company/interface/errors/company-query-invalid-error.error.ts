import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyQueryInvalidError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 400,
      code: "invalid_company_query",
      detail: "Company query is invalid",
      cause,
    })
  }
}
