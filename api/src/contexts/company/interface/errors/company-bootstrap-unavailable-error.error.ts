import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyBootstrapUnavailableError extends CompanyHTTPException {
  constructor(cause?: unknown) {
    super({
      status: 503,
      code: "company_bootstrap_unavailable",
      detail: "Company bootstrap service is unavailable",
      cause,
    })
  }
}
