import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyOrganizationProfileReadFailedError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 500,
      code: "organization_profile_read_failed",
      detail: "Organization profile could not be read",
      cause,
    })
  }
}
