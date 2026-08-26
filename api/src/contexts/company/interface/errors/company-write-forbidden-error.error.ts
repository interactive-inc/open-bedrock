import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyWriteForbiddenError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 403,
      code: "company_write_forbidden",
      detail: "Company write capability is required",
      cause,
    })
  }
}
