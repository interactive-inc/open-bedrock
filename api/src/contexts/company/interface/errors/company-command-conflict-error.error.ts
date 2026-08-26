import { CompanyHTTPException } from "@/contexts/company/interface/errors/company-http-exception.error"

export class CompanyCommandConflictError extends CompanyHTTPException {
  constructor() {
    super({
      status: 409,
      code: "company_command_conflict",
      detail: "Idempotency key was reused",
    })
  }
}
