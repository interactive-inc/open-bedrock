import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyHeadersInvalidError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 400,
      code: "invalid_company_headers",
      detail: "Company request headers are invalid",
      cause,
    })
  }
}
