import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyDatabaseUnavailableError extends CompanyHTTPException {
  constructor() {
    super({
      status: 503,
      code: "company_database_unavailable",
      detail: "Company storage is unavailable",
    })
  }
}
