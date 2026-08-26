import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyInvariantValidationError extends CompanyHTTPException {
  constructor(code: string, cause: unknown) {
    super({ status: 422, code, detail: "Company invariant validation failed", cause })
  }
}
