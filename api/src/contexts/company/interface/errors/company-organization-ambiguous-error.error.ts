import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyOrganizationAmbiguousError extends CompanyHTTPException {
  constructor() {
    super({
      status: 403,
      code: "company_organization_ambiguous",
      detail: "Exactly one Company organization must be selected",
    })
  }
}
