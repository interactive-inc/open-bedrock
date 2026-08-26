import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyReadForbiddenError extends CompanyHTTPException {
  constructor() {
    super({
      status: 403,
      code: "company_read_forbidden",
      detail: "Company read capability is required",
    })
  }
}
