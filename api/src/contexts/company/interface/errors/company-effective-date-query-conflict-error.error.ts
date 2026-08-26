import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyEffectiveDateQueryConflictError extends CompanyHTTPException {
  constructor() {
    super({
      status: 400,
      code: "invalid_company_query",
      detail: "effective_on and as_of must name the same date",
    })
  }
}
