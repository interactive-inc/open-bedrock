import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyResourceOrganizationMismatchError extends CompanyHTTPException {
  constructor() {
    super({
      status: 422,
      code: "invalid_company_resource",
      detail: "A Company resource is outside the requested organization",
    })
  }
}
