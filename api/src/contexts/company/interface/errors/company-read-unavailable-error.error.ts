import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyReadUnavailableError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 503,
      code: "company_read_unavailable",
      detail: "Company data could not be read",
      cause,
    })
  }
}
