import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyOrganizationProfileNotConfiguredError extends CompanyHTTPException {
  constructor() {
    super({
      status: 404,
      code: "organization_profile_not_configured",
      detail: "Organization profile is not configured",
    })
  }
}
