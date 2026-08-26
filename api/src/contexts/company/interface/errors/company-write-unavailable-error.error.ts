import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyWriteUnavailableError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 503,
      code: "company_write_unavailable",
      detail: "Company change was not applied",
      cause,
    })
  }
}
