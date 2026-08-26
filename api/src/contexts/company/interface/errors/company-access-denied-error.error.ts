import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyAccessDeniedError extends CompanyHTTPException {
  constructor() {
    super({
      status: 403,
      code: "company_access_denied",
      detail: "Company scope or capability is missing",
    })
  }
}
