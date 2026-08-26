import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyAuthenticationRequiredError extends CompanyHTTPException {
  constructor() {
    super({
      status: 401,
      code: "authentication_required",
      detail: "Authentication is required",
    })
  }
}
