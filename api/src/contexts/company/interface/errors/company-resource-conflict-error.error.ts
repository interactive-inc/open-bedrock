import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyResourceConflictError extends CompanyHTTPException {
  constructor() {
    super({
      status: 409,
      code: "company_resource_conflict",
      detail: "Resource revision has changed",
    })
  }
}
