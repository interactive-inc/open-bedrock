import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyOrganizationProfileWriteFailedError extends CompanyHTTPException {
  constructor(cause: unknown) {
    super({
      status: 500,
      code: "organization_profile_write_failed",
      detail: "Organization profile could not be written",
      cause,
    })
  }
}
