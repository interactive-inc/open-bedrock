import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyBodyInvalidError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 400,
      code: "invalid_company_body",
      detail: "Company request body is invalid",
      cause,
    })
  }
}
