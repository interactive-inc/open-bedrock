import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyRevisionConflictError extends CompanyHTTPException {
  constructor(etag: string) {
    super({
      status: 409,
      code: "company_revision_conflict",
      detail: "Company revision has changed",
      etag,
    })
  }
}
