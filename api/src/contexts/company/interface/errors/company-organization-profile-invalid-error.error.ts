import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyOrganizationProfileInvalidError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 400,
      code: "invalid_organization_profile",
      detail: "Organization profile is invalid",
      cause,
    })
  }
}
